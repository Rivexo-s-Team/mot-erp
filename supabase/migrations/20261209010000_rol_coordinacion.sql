-- Rol de Coordinación (DISENO §9, D58): quien programa las visitas y lleva las
-- órdenes de servicio desde la oficina. Crea órdenes, las asigna a un técnico y
-- las corrige; consulta clientes, contratos (sin precios), flota, inventario,
-- documentos de acceso y laboratorio. No ve precios, cargos ni facturación.
insert into public.roles (clave, nombre, descripcion, es_interno) values
  ('coordinacion', 'Coordinación',
   'Programa visitas y lleva las órdenes de servicio. Consulta clientes, flota e inventario. Sin precios.', true);

insert into public.rol_permisos (rol_id, permiso_id)
select r.id, p.id
from public.roles r
join public.permisos p on p.clave in (
  'ordenes.ver', 'ordenes.editar', 'ordenes.administrar',
  'clientes.ver', 'contratos.ver', 'flota.ver', 'inventario.ver',
  'documentos_acceso.ver', 'laboratorio.ver', 'catalogos.ver'
)
where r.clave = 'coordinacion';
