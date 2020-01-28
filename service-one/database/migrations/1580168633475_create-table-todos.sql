create table "todos" (
  "todoId"      uuid           not null default uuid_generate_v4(),
  "task"        text           not null,
  "isCompleted" boolean        not null default false,
  "createdAt"   timestamptz(6) not null default now()
);
---

drop table "todos";
