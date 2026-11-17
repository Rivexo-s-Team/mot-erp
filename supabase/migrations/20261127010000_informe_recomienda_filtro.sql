-- Etapa 4, paso 6: el laboratorio puede indicar en un informe que hay que
-- cambiar el filtro del Robox (DISENO §4.4: "a los 6 meses o antes si el
-- laboratorio lo indica"). Con el informe validado, el Robox que atiende ese
-- equipo muestra la alerta hasta que se le instale un filtro.
alter table public.informes
  add column recomienda_cambio_filtro boolean not null default false;
comment on column public.informes.recomienda_cambio_filtro is
  'El laboratorio recomienda cambiar el filtro del Robox que atiende al equipo. Cuenta cuando el informe está validado.';
