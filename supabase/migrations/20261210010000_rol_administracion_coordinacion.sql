-- Rol combinado de Administración y Coordinación (DISENO §9, D59).
-- MOT decidió que Claudia (facturación y cobranza) y Erika (agenda y órdenes)
-- entren con un mismo usuario. Un usuario lleva un solo rol, así que este rol
-- reúne los permisos de los dos: todo lo de Administración más crear, asignar y
-- corregir órdenes de servicio.
insert into public.roles (clave, nombre, descripcion, es_interno) values
  ('administracion_coordinacion', 'Administración y coordinación',
   'Facturación, cobranza, contratos e inventario, y además programa visitas y lleva las órdenes de servicio.', true);

insert into public.rol_permisos (rol_id, permiso_id)
select distinct nuevo.id, rp.permiso_id
from public.roles nuevo
join public.roles origen on origen.clave in ('administracion', 'coordinacion')
join public.rol_permisos rp on rp.rol_id = origen.id
where nuevo.clave = 'administracion_coordinacion';
