-- Datos de instalación del sitio, por equipo del cliente (DISENO §9, D56).
-- Operación pidió conocerlos antes de llevar el Robox, para no llegar sin la
-- manguera o la conexión correctas. Los recaba Comercial en la visita.
-- Voltaje y corriente van como texto: se anotan como los dice la planta
-- ("220 V trifásico", "16 A"). La conexión ya existía (tipo_conexion).
alter table public.equipos_cliente
  add column voltaje text,
  add column corriente text,
  add column distancia_reservorio_m numeric check (distancia_reservorio_m > 0);
comment on column public.equipos_cliente.voltaje is
  'Voltaje disponible junto al equipo para conectar el Robox, como lo dice la planta.';
comment on column public.equipos_cliente.corriente is
  'Corriente disponible en esa toma, como la dice la planta.';
comment on column public.equipos_cliente.distancia_reservorio_m is
  'Metros entre donde quedará el Robox y el reservorio de aceite. Define el largo de manguera.';
