-- TapBit: Ranking da Sala.
-- O professor cria uma sala e recebe um código (ex.: K7P2Q). Os alunos entram com o código
-- e o primeiro nome. Cada sala mostra só os 5 melhores do DIA na Missão Relâmpago,
-- para estimular sem expor quem teve mais dificuldade.
-- Como usar: no Supabase, abra "SQL Editor", cole este arquivo inteiro e clique em "Run".
-- Pode rodar de novo sem perder dados.

create table if not exists public.tapbit_salas (
  codigo     text primary key check (codigo ~ '^[A-Z2-9]{5}$'),
  nome       text not null check (char_length(nome) between 2 and 40),
  criada_em  timestamptz not null default now()
);

create table if not exists public.tapbit_pontos (
  id            bigint generated always as identity primary key,
  codigo        text not null references public.tapbit_salas(codigo) on delete cascade,
  nome          text not null check (char_length(nome) between 2 and 20),
  nome_chave    text not null,
  dia           date not null default (now() at time zone 'America/Sao_Paulo')::date,
  pontos        integer not null check (pontos between 0 and 1000000),
  atualizado_em timestamptz not null default now(),
  unique (codigo, nome_chave, dia)
);

-- Ninguém lê nem escreve direto nas tabelas: só pelas funções abaixo.
alter table public.tapbit_salas enable row level security;
alter table public.tapbit_pontos enable row level security;
revoke all on public.tapbit_salas from anon, authenticated;
revoke all on public.tapbit_pontos from anon, authenticated;

-- Cria uma sala e devolve o código.
create or replace function public.tapbit_criar_sala(p_nome text)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_nome text := regexp_replace(btrim(coalesce(p_nome, '')), '\s+', ' ', 'g');
  v_cod text;
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  i int;
begin
  if char_length(v_nome) < 2 or char_length(v_nome) > 40 then raise exception 'nome invalido'; end if;
  loop
    v_cod := '';
    for i in 1..5 loop
      v_cod := v_cod || substr(chars, 1 + floor(random() * length(chars))::int, 1);
    end loop;
    exit when not exists (select 1 from tapbit_salas where codigo = v_cod);
  end loop;
  insert into tapbit_salas (codigo, nome) values (v_cod, v_nome);
  return v_cod;
end; $$;

-- Nome da sala (ou nulo, se o código não existe).
create or replace function public.tapbit_sala(p_codigo text)
returns text language sql security definer set search_path = public stable as $$
  select nome from tapbit_salas where codigo = upper(btrim(p_codigo));
$$;

-- Guarda a melhor pontuação do aluno no dia.
create or replace function public.tapbit_enviar(p_codigo text, p_nome text, p_pontos integer)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_nome text := regexp_replace(btrim(coalesce(p_nome, '')), '\s+', ' ', 'g');
  v_cod text := upper(btrim(coalesce(p_codigo, '')));
begin
  if char_length(v_nome) < 2 or char_length(v_nome) > 20 then raise exception 'nome invalido'; end if;
  if p_pontos is null or p_pontos < 0 or p_pontos > 1000000 then raise exception 'pontos invalidos'; end if;
  if not exists (select 1 from tapbit_salas where codigo = v_cod) then raise exception 'sala inexistente'; end if;
  insert into tapbit_pontos (codigo, nome, nome_chave, pontos)
  values (v_cod, v_nome, lower(v_nome), p_pontos)
  on conflict (codigo, nome_chave, dia) do update
    set pontos = excluded.pontos, nome = excluded.nome, atualizado_em = now()
    where excluded.pontos > tapbit_pontos.pontos;
end; $$;

-- Os 5 melhores de hoje na sala.
create or replace function public.tapbit_top5(p_codigo text)
returns table (nome text, pontos integer) language sql security definer set search_path = public stable as $$
  select nome, pontos from tapbit_pontos
  where codigo = upper(btrim(p_codigo))
    and dia = (now() at time zone 'America/Sao_Paulo')::date
  order by pontos desc, atualizado_em asc
  limit 5;
$$;

revoke all on function public.tapbit_criar_sala(text) from public;
revoke all on function public.tapbit_sala(text) from public;
revoke all on function public.tapbit_enviar(text, text, integer) from public;
revoke all on function public.tapbit_top5(text) from public;
grant execute on function public.tapbit_criar_sala(text) to anon, authenticated;
grant execute on function public.tapbit_sala(text) to anon, authenticated;
grant execute on function public.tapbit_enviar(text, text, integer) to anon, authenticated;
grant execute on function public.tapbit_top5(text) to anon, authenticated;

-- Para apagar pontuações antigas (por exemplo, todo mês):
--   delete from public.tapbit_pontos where dia < current_date - 30;
-- Para apagar uma sala e tudo dela:
--   delete from public.tapbit_salas where codigo = 'K7P2Q';
