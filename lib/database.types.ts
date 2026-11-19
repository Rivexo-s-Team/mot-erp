export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      aceites: {
        Row: {
          activo: boolean;
          created_at: string;
          created_by: string | null;
          grado_iso_vg: number | null;
          id: string;
          marca: string;
          nombre_comercial: string;
          updated_at: string;
          viscosidad_nominal_40c: number | null;
        };
        ComputedFields: never;
        Insert: {
          activo?: boolean;
          created_at?: string;
          created_by?: string | null;
          grado_iso_vg?: number | null;
          id?: string;
          marca: string;
          nombre_comercial: string;
          updated_at?: string;
          viscosidad_nominal_40c?: number | null;
        };
        Update: {
          activo?: boolean;
          created_at?: string;
          created_by?: string | null;
          grado_iso_vg?: number | null;
          id?: string;
          marca?: string;
          nombre_comercial?: string;
          updated_at?: string;
          viscosidad_nominal_40c?: number | null;
        };
        Relationships: [];
      };
      actividades: {
        Row: {
          activo: boolean;
          created_at: string;
          created_by: string | null;
          id: string;
          lleva_cantidad: boolean;
          nombre: string;
          orden: number;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          activo?: boolean;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          lleva_cantidad?: boolean;
          nombre: string;
          orden?: number;
          updated_at?: string;
        };
        Update: {
          activo?: boolean;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          lleva_cantidad?: boolean;
          nombre?: string;
          orden?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      actividades_comerciales: {
        Row: {
          created_at: string;
          created_by: string | null;
          deleted_at: string | null;
          fecha: string;
          id: string;
          notas: string | null;
          oportunidad_id: string;
          responsable_id: string;
          tipo: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          fecha: string;
          id?: string;
          notas?: string | null;
          oportunidad_id: string;
          responsable_id: string;
          tipo: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          fecha?: string;
          id?: string;
          notas?: string | null;
          oportunidad_id?: string;
          responsable_id?: string;
          tipo?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "actividades_comerciales_oportunidad_id_fkey";
            columns: ["oportunidad_id"];
            isOneToOne: false;
            referencedRelation: "oportunidades";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "actividades_comerciales_responsable_id_fkey";
            columns: ["responsable_id"];
            isOneToOne: false;
            referencedRelation: "perfiles";
            referencedColumns: ["id"];
          },
        ];
      };
      asignaciones_robox: {
        Row: {
          contrato_id: string;
          created_at: string;
          created_by: string | null;
          deleted_at: string | null;
          fecha_fin: string | null;
          fecha_inicio: string;
          id: string;
          notas: string | null;
          planta_id: string;
          robox_id: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          contrato_id: string;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          fecha_fin?: string | null;
          fecha_inicio: string;
          id?: string;
          notas?: string | null;
          planta_id: string;
          robox_id: string;
          updated_at?: string;
        };
        Update: {
          contrato_id?: string;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          fecha_fin?: string | null;
          fecha_inicio?: string;
          id?: string;
          notas?: string | null;
          planta_id?: string;
          robox_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "asignaciones_robox_contrato_id_planta_id_fkey";
            columns: ["contrato_id", "planta_id"];
            isOneToOne: false;
            referencedRelation: "contratos";
            referencedColumns: ["id", "planta_id"];
          },
          {
            foreignKeyName: "asignaciones_robox_robox_id_fkey";
            columns: ["robox_id"];
            isOneToOne: false;
            referencedRelation: "robox";
            referencedColumns: ["id"];
          },
        ];
      };
      bitacora: {
        Row: {
          created_at: string;
          datos_anteriores: Json | null;
          datos_nuevos: Json | null;
          id: string;
          operacion: string;
          registro_id: string;
          tabla: string;
          usuario_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          datos_anteriores?: Json | null;
          datos_nuevos?: Json | null;
          id?: string;
          operacion: string;
          registro_id: string;
          tabla: string;
          usuario_id?: string | null;
        };
        Update: {
          created_at?: string;
          datos_anteriores?: Json | null;
          datos_nuevos?: Json | null;
          id?: string;
          operacion?: string;
          registro_id?: string;
          tabla?: string;
          usuario_id?: string | null;
        };
        Relationships: [];
      };
      canales_venta: {
        Row: {
          activo: boolean;
          correo: string | null;
          created_at: string;
          created_by: string | null;
          id: string;
          nombre: string;
          notas: string | null;
          telefono: string | null;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          activo?: boolean;
          correo?: string | null;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          nombre: string;
          notas?: string | null;
          telefono?: string | null;
          updated_at?: string;
        };
        Update: {
          activo?: boolean;
          correo?: string | null;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          nombre?: string;
          notas?: string | null;
          telefono?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      cargos: {
        Row: {
          cantidad: number | null;
          concepto: string;
          contrato_id: string | null;
          created_at: string;
          created_by: string | null;
          cuenta_id: string;
          deleted_at: string | null;
          estado: string;
          factura_id: string | null;
          id: string;
          importe: number | null;
          moneda: string;
          notas: string | null;
          orden_compra_id: string | null;
          orden_id: string | null;
          periodo: string | null;
          precio_unitario: number | null;
          tarifa_id: string | null;
          tipo: string;
          unidad: string | null;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          cantidad?: number | null;
          concepto: string;
          contrato_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          cuenta_id: string;
          deleted_at?: string | null;
          estado?: string;
          factura_id?: string | null;
          id?: string;
          importe?: never;
          moneda?: string;
          notas?: string | null;
          orden_compra_id?: string | null;
          orden_id?: string | null;
          periodo?: string | null;
          precio_unitario?: number | null;
          tarifa_id?: string | null;
          tipo: string;
          unidad?: string | null;
          updated_at?: string;
        };
        Update: {
          cantidad?: number | null;
          concepto?: string;
          contrato_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          cuenta_id?: string;
          deleted_at?: string | null;
          estado?: string;
          factura_id?: string | null;
          id?: string;
          importe?: never;
          moneda?: string;
          notas?: string | null;
          orden_compra_id?: string | null;
          orden_id?: string | null;
          periodo?: string | null;
          precio_unitario?: number | null;
          tarifa_id?: string | null;
          tipo?: string;
          unidad?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "cargos_contrato_id_cuenta_id_fkey";
            columns: ["contrato_id", "cuenta_id"];
            isOneToOne: false;
            referencedRelation: "contratos";
            referencedColumns: ["id", "cuenta_id"];
          },
          {
            foreignKeyName: "cargos_cuenta_id_fkey";
            columns: ["cuenta_id"];
            isOneToOne: false;
            referencedRelation: "cuentas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "cargos_factura_id_fkey";
            columns: ["factura_id"];
            isOneToOne: false;
            referencedRelation: "anticipo_saldos";
            referencedColumns: ["factura_id"];
          },
          {
            foreignKeyName: "cargos_factura_id_fkey";
            columns: ["factura_id"];
            isOneToOne: false;
            referencedRelation: "factura_saldos";
            referencedColumns: ["factura_id"];
          },
          {
            foreignKeyName: "cargos_factura_id_fkey";
            columns: ["factura_id"];
            isOneToOne: false;
            referencedRelation: "factura_totales";
            referencedColumns: ["factura_id"];
          },
          {
            foreignKeyName: "cargos_factura_id_fkey";
            columns: ["factura_id"];
            isOneToOne: false;
            referencedRelation: "facturas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "cargos_orden_compra_id_fkey";
            columns: ["orden_compra_id"];
            isOneToOne: false;
            referencedRelation: "orden_compra_saldos";
            referencedColumns: ["orden_compra_id"];
          },
          {
            foreignKeyName: "cargos_orden_compra_id_fkey";
            columns: ["orden_compra_id"];
            isOneToOne: false;
            referencedRelation: "ordenes_compra";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "cargos_orden_id_fkey";
            columns: ["orden_id"];
            isOneToOne: false;
            referencedRelation: "ordenes_servicio";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "cargos_tarifa_id_fkey";
            columns: ["tarifa_id"];
            isOneToOne: false;
            referencedRelation: "contrato_tarifas";
            referencedColumns: ["id"];
          },
        ];
      };
      carrusel_equipos: {
        Row: {
          asignacion_id: string;
          created_at: string;
          created_by: string | null;
          deleted_at: string | null;
          equipo_cliente_id: string;
          id: string;
          id_caso: string | null;
          orden: number;
          planta_id: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          asignacion_id: string;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          equipo_cliente_id: string;
          id?: string;
          id_caso?: string | null;
          orden?: number;
          planta_id: string;
          updated_at?: string;
        };
        Update: {
          asignacion_id?: string;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          equipo_cliente_id?: string;
          id?: string;
          id_caso?: string | null;
          orden?: number;
          planta_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "carrusel_equipos_asignacion_id_planta_id_fkey";
            columns: ["asignacion_id", "planta_id"];
            isOneToOne: false;
            referencedRelation: "asignaciones_robox";
            referencedColumns: ["id", "planta_id"];
          },
          {
            foreignKeyName: "carrusel_equipos_asignacion_id_planta_id_fkey";
            columns: ["asignacion_id", "planta_id"];
            isOneToOne: false;
            referencedRelation: "robox_ubicacion";
            referencedColumns: ["asignacion_id", "planta_id"];
          },
          {
            foreignKeyName: "carrusel_equipos_equipo_cliente_id_planta_id_fkey";
            columns: ["equipo_cliente_id", "planta_id"];
            isOneToOne: false;
            referencedRelation: "equipos_cliente";
            referencedColumns: ["id", "planta_id"];
          },
        ];
      };
      condiciones_credito: {
        Row: {
          contacto_cxp_id: string | null;
          created_at: string;
          created_by: string | null;
          cuenta_id: string;
          dias_credito: number;
          forma_pago: string | null;
          id: string | null;
          metodo_pago: string | null;
          notas: string | null;
          portal: string | null;
          razon_social_id: string;
          requiere_orden_compra: boolean;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          contacto_cxp_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          cuenta_id: string;
          dias_credito?: number;
          forma_pago?: string | null;
          id?: never;
          metodo_pago?: string | null;
          notas?: string | null;
          portal?: string | null;
          razon_social_id: string;
          requiere_orden_compra?: boolean;
          updated_at?: string;
        };
        Update: {
          contacto_cxp_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          cuenta_id?: string;
          dias_credito?: number;
          forma_pago?: string | null;
          id?: never;
          metodo_pago?: string | null;
          notas?: string | null;
          portal?: string | null;
          razon_social_id?: string;
          requiere_orden_compra?: boolean;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "condiciones_credito_contacto_cxp_id_cuenta_id_fkey";
            columns: ["contacto_cxp_id", "cuenta_id"];
            isOneToOne: false;
            referencedRelation: "contactos";
            referencedColumns: ["id", "cuenta_id"];
          },
          {
            foreignKeyName: "condiciones_credito_cuenta_id_fkey";
            columns: ["cuenta_id"];
            isOneToOne: false;
            referencedRelation: "cuentas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "condiciones_credito_razon_social_id_cuenta_id_fkey";
            columns: ["razon_social_id", "cuenta_id"];
            isOneToOne: false;
            referencedRelation: "razones_sociales";
            referencedColumns: ["id", "cuenta_id"];
          },
        ];
      };
      contactos: {
        Row: {
          area: string;
          correo: string | null;
          created_at: string;
          created_by: string | null;
          cuenta_id: string;
          deleted_at: string | null;
          id: string;
          nombre: string;
          notas: string | null;
          planta_id: string | null;
          puesto: string | null;
          recibe_facturas: boolean;
          recibe_informes: boolean;
          telefono_celular: string | null;
          telefono_oficina: string | null;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          area: string;
          correo?: string | null;
          created_at?: string;
          created_by?: string | null;
          cuenta_id: string;
          deleted_at?: string | null;
          id?: string;
          nombre: string;
          notas?: string | null;
          planta_id?: string | null;
          puesto?: string | null;
          recibe_facturas?: boolean;
          recibe_informes?: boolean;
          telefono_celular?: string | null;
          telefono_oficina?: string | null;
          updated_at?: string;
        };
        Update: {
          area?: string;
          correo?: string | null;
          created_at?: string;
          created_by?: string | null;
          cuenta_id?: string;
          deleted_at?: string | null;
          id?: string;
          nombre?: string;
          notas?: string | null;
          planta_id?: string | null;
          puesto?: string | null;
          recibe_facturas?: boolean;
          recibe_informes?: boolean;
          telefono_celular?: string | null;
          telefono_oficina?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "contactos_cuenta_id_fkey";
            columns: ["cuenta_id"];
            isOneToOne: false;
            referencedRelation: "cuentas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "contactos_planta_id_cuenta_id_fkey";
            columns: ["planta_id", "cuenta_id"];
            isOneToOne: false;
            referencedRelation: "plantas";
            referencedColumns: ["id", "cuenta_id"];
          },
        ];
      };
      contrato_tarifas: {
        Row: {
          concepto: string;
          contrato_id: string;
          created_at: string;
          created_by: string | null;
          deleted_at: string | null;
          equipo_cliente_id: string | null;
          es_anticipo: boolean;
          id: string;
          notas: string | null;
          orden: number;
          orden_compra_id: string | null;
          planta_id: string;
          precio: number;
          unidad: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          concepto: string;
          contrato_id: string;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          equipo_cliente_id?: string | null;
          es_anticipo?: boolean;
          id?: string;
          notas?: string | null;
          orden?: number;
          orden_compra_id?: string | null;
          planta_id: string;
          precio: number;
          unidad: string;
          updated_at?: string;
        };
        Update: {
          concepto?: string;
          contrato_id?: string;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          equipo_cliente_id?: string | null;
          es_anticipo?: boolean;
          id?: string;
          notas?: string | null;
          orden?: number;
          orden_compra_id?: string | null;
          planta_id?: string;
          precio?: number;
          unidad?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "contrato_tarifas_contrato_id_planta_id_fkey";
            columns: ["contrato_id", "planta_id"];
            isOneToOne: false;
            referencedRelation: "contratos";
            referencedColumns: ["id", "planta_id"];
          },
          {
            foreignKeyName: "contrato_tarifas_equipo_cliente_id_planta_id_fkey";
            columns: ["equipo_cliente_id", "planta_id"];
            isOneToOne: false;
            referencedRelation: "equipos_cliente";
            referencedColumns: ["id", "planta_id"];
          },
          {
            foreignKeyName: "contrato_tarifas_orden_compra_fkey";
            columns: ["orden_compra_id", "contrato_id"];
            isOneToOne: false;
            referencedRelation: "orden_compra_saldos";
            referencedColumns: ["orden_compra_id", "contrato_id"];
          },
          {
            foreignKeyName: "contrato_tarifas_orden_compra_fkey";
            columns: ["orden_compra_id", "contrato_id"];
            isOneToOne: false;
            referencedRelation: "ordenes_compra";
            referencedColumns: ["id", "contrato_id"];
          },
        ];
      };
      contratos: {
        Row: {
          contrato_origen_id: string | null;
          cotizacion_id: string | null;
          created_at: string;
          created_by: string | null;
          cuenta_id: string;
          deleted_at: string | null;
          estado: string;
          fecha_inicio: string | null;
          fecha_termino: string | null;
          frecuencia_visitas: string | null;
          id: string;
          incluye_filtros: boolean;
          incluye_laboratorio: boolean;
          moneda: string;
          notas: string | null;
          oportunidad_id: string | null;
          planta_id: string;
          razon_social_id: string | null;
          referencia: string | null;
          tipo: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          contrato_origen_id?: string | null;
          cotizacion_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          cuenta_id: string;
          deleted_at?: string | null;
          estado?: string;
          fecha_inicio?: string | null;
          fecha_termino?: string | null;
          frecuencia_visitas?: string | null;
          id?: string;
          incluye_filtros?: boolean;
          incluye_laboratorio?: boolean;
          moneda?: string;
          notas?: string | null;
          oportunidad_id?: string | null;
          planta_id: string;
          razon_social_id?: string | null;
          referencia?: string | null;
          tipo: string;
          updated_at?: string;
        };
        Update: {
          contrato_origen_id?: string | null;
          cotizacion_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          cuenta_id?: string;
          deleted_at?: string | null;
          estado?: string;
          fecha_inicio?: string | null;
          fecha_termino?: string | null;
          frecuencia_visitas?: string | null;
          id?: string;
          incluye_filtros?: boolean;
          incluye_laboratorio?: boolean;
          moneda?: string;
          notas?: string | null;
          oportunidad_id?: string | null;
          planta_id?: string;
          razon_social_id?: string | null;
          referencia?: string | null;
          tipo?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "contratos_contrato_origen_id_cuenta_id_fkey";
            columns: ["contrato_origen_id", "cuenta_id"];
            isOneToOne: false;
            referencedRelation: "contratos";
            referencedColumns: ["id", "cuenta_id"];
          },
          {
            foreignKeyName: "contratos_cotizacion_id_oportunidad_id_fkey";
            columns: ["cotizacion_id", "oportunidad_id"];
            isOneToOne: false;
            referencedRelation: "cotizaciones";
            referencedColumns: ["id", "oportunidad_id"];
          },
          {
            foreignKeyName: "contratos_cuenta_id_fkey";
            columns: ["cuenta_id"];
            isOneToOne: false;
            referencedRelation: "cuentas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "contratos_oportunidad_id_cuenta_id_fkey";
            columns: ["oportunidad_id", "cuenta_id"];
            isOneToOne: false;
            referencedRelation: "oportunidades";
            referencedColumns: ["id", "cuenta_id"];
          },
          {
            foreignKeyName: "contratos_planta_id_cuenta_id_fkey";
            columns: ["planta_id", "cuenta_id"];
            isOneToOne: false;
            referencedRelation: "plantas";
            referencedColumns: ["id", "cuenta_id"];
          },
          {
            foreignKeyName: "contratos_razon_social_id_cuenta_id_fkey";
            columns: ["razon_social_id", "cuenta_id"];
            isOneToOne: false;
            referencedRelation: "razones_sociales";
            referencedColumns: ["id", "cuenta_id"];
          },
        ];
      };
      cotizacion_lineas: {
        Row: {
          cantidad: number;
          concepto: string;
          cotizacion_id: string;
          created_at: string;
          created_by: string | null;
          deleted_at: string | null;
          equipo_cliente_id: string | null;
          fecha_referencia: string | null;
          fuente_archivo_nombre: string | null;
          fuente_archivo_ruta: string | null;
          fuente_tipo: string | null;
          fuente_url: string | null;
          id: string;
          importe: number | null;
          numero_parte_cliente: string | null;
          orden: number;
          precio_referencia: number | null;
          precio_unitario: number;
          recurrente: boolean;
          referencia_costo_contenedor: number | null;
          referencia_litros_contenedor: number | null;
          unidad: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          cantidad: number;
          concepto: string;
          cotizacion_id: string;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          equipo_cliente_id?: string | null;
          fecha_referencia?: string | null;
          fuente_archivo_nombre?: string | null;
          fuente_archivo_ruta?: string | null;
          fuente_tipo?: string | null;
          fuente_url?: string | null;
          id?: string;
          importe?: never;
          numero_parte_cliente?: string | null;
          orden?: number;
          precio_referencia?: number | null;
          precio_unitario: number;
          recurrente?: boolean;
          referencia_costo_contenedor?: number | null;
          referencia_litros_contenedor?: number | null;
          unidad: string;
          updated_at?: string;
        };
        Update: {
          cantidad?: number;
          concepto?: string;
          cotizacion_id?: string;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          equipo_cliente_id?: string | null;
          fecha_referencia?: string | null;
          fuente_archivo_nombre?: string | null;
          fuente_archivo_ruta?: string | null;
          fuente_tipo?: string | null;
          fuente_url?: string | null;
          id?: string;
          importe?: never;
          numero_parte_cliente?: string | null;
          orden?: number;
          precio_referencia?: number | null;
          precio_unitario?: number;
          recurrente?: boolean;
          referencia_costo_contenedor?: number | null;
          referencia_litros_contenedor?: number | null;
          unidad?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "cotizacion_lineas_cotizacion_id_fkey";
            columns: ["cotizacion_id"];
            isOneToOne: false;
            referencedRelation: "cotizacion_totales";
            referencedColumns: ["cotizacion_id"];
          },
          {
            foreignKeyName: "cotizacion_lineas_cotizacion_id_fkey";
            columns: ["cotizacion_id"];
            isOneToOne: false;
            referencedRelation: "cotizaciones";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "cotizacion_lineas_equipo_cliente_id_fkey";
            columns: ["equipo_cliente_id"];
            isOneToOne: false;
            referencedRelation: "equipos_cliente";
            referencedColumns: ["id"];
          },
        ];
      };
      cotizaciones: {
        Row: {
          condiciones: string | null;
          condiciones_pago: string | null;
          contacto_id: string | null;
          created_at: string;
          created_by: string | null;
          deleted_at: string | null;
          estado: string;
          folio: string;
          id: string;
          litros_estimados: number | null;
          moneda: string;
          notas: string | null;
          numero_requisicion: string | null;
          oportunidad_id: string;
          tipo_cambio: number | null;
          updated_at: string;
          valor_total_contrato: number | null;
          version: number;
          vigencia: string | null;
        };
        ComputedFields: never;
        Insert: {
          condiciones?: string | null;
          condiciones_pago?: string | null;
          contacto_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          estado?: string;
          folio: string;
          id?: string;
          litros_estimados?: number | null;
          moneda?: string;
          notas?: string | null;
          numero_requisicion?: string | null;
          oportunidad_id: string;
          tipo_cambio?: number | null;
          updated_at?: string;
          valor_total_contrato?: number | null;
          version: number;
          vigencia?: string | null;
        };
        Update: {
          condiciones?: string | null;
          condiciones_pago?: string | null;
          contacto_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          estado?: string;
          folio?: string;
          id?: string;
          litros_estimados?: number | null;
          moneda?: string;
          notas?: string | null;
          numero_requisicion?: string | null;
          oportunidad_id?: string;
          tipo_cambio?: number | null;
          updated_at?: string;
          valor_total_contrato?: number | null;
          version?: number;
          vigencia?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "cotizaciones_contacto_id_fkey";
            columns: ["contacto_id"];
            isOneToOne: false;
            referencedRelation: "contactos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "cotizaciones_oportunidad_id_fkey";
            columns: ["oportunidad_id"];
            isOneToOne: false;
            referencedRelation: "oportunidades";
            referencedColumns: ["id"];
          },
        ];
      };
      cuentas: {
        Row: {
          created_at: string;
          created_by: string | null;
          deleted_at: string | null;
          id: string;
          nombre: string;
          notas: string | null;
          tipo_industria: string | null;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          id?: string;
          nombre: string;
          notas?: string | null;
          tipo_industria?: string | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          id?: string;
          nombre?: string;
          notas?: string | null;
          tipo_industria?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      documentos_acceso: {
        Row: {
          archivo_nombre: string | null;
          archivo_ruta: string | null;
          created_at: string;
          created_by: string | null;
          deleted_at: string | null;
          fecha_vencimiento: string | null;
          id: string;
          notas: string | null;
          perfil_id: string | null;
          tipo_id: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          archivo_nombre?: string | null;
          archivo_ruta?: string | null;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          fecha_vencimiento?: string | null;
          id?: string;
          notas?: string | null;
          perfil_id?: string | null;
          tipo_id: string;
          updated_at?: string;
        };
        Update: {
          archivo_nombre?: string | null;
          archivo_ruta?: string | null;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          fecha_vencimiento?: string | null;
          id?: string;
          notas?: string | null;
          perfil_id?: string | null;
          tipo_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "documentos_acceso_perfil_id_fkey";
            columns: ["perfil_id"];
            isOneToOne: false;
            referencedRelation: "perfiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "documentos_acceso_tipo_id_fkey";
            columns: ["tipo_id"];
            isOneToOne: false;
            referencedRelation: "tipos_documento_acceso";
            referencedColumns: ["id"];
          },
        ];
      };
      equipos_cliente: {
        Row: {
          aceite_id: string | null;
          alias: string | null;
          altura: string | null;
          aplicacion: string | null;
          created_at: string;
          created_by: string | null;
          deleted_at: string | null;
          frecuencia_cambio_aceite: string | null;
          id: string;
          identificador: string;
          localizacion: string | null;
          marca: string | null;
          notas: string | null;
          numero_contenedores: number | null;
          planta_id: string;
          temperatura_operacion_c: number | null;
          tipo_conexion: string | null;
          toma_muestras: string | null;
          updated_at: string;
          volumen_contenedor_l: number | null;
          volumen_reservorio_l: number | null;
        };
        ComputedFields: never;
        Insert: {
          aceite_id?: string | null;
          alias?: string | null;
          altura?: string | null;
          aplicacion?: string | null;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          frecuencia_cambio_aceite?: string | null;
          id?: string;
          identificador: string;
          localizacion?: string | null;
          marca?: string | null;
          notas?: string | null;
          numero_contenedores?: number | null;
          planta_id: string;
          temperatura_operacion_c?: number | null;
          tipo_conexion?: string | null;
          toma_muestras?: string | null;
          updated_at?: string;
          volumen_contenedor_l?: number | null;
          volumen_reservorio_l?: number | null;
        };
        Update: {
          aceite_id?: string | null;
          alias?: string | null;
          altura?: string | null;
          aplicacion?: string | null;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          frecuencia_cambio_aceite?: string | null;
          id?: string;
          identificador?: string;
          localizacion?: string | null;
          marca?: string | null;
          notas?: string | null;
          numero_contenedores?: number | null;
          planta_id?: string;
          temperatura_operacion_c?: number | null;
          tipo_conexion?: string | null;
          toma_muestras?: string | null;
          updated_at?: string;
          volumen_contenedor_l?: number | null;
          volumen_reservorio_l?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "equipos_cliente_aceite_id_fkey";
            columns: ["aceite_id"];
            isOneToOne: false;
            referencedRelation: "aceites";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "equipos_cliente_planta_id_fkey";
            columns: ["planta_id"];
            isOneToOne: false;
            referencedRelation: "plantas";
            referencedColumns: ["id"];
          },
        ];
      };
      equipos_cliente_costos: {
        Row: {
          costo_aceite_virgen: number;
          created_at: string;
          created_by: string | null;
          equipo_cliente_id: string;
          id: string | null;
          moneda: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          costo_aceite_virgen: number;
          created_at?: string;
          created_by?: string | null;
          equipo_cliente_id: string;
          id?: never;
          moneda: string;
          updated_at?: string;
        };
        Update: {
          costo_aceite_virgen?: number;
          created_at?: string;
          created_by?: string | null;
          equipo_cliente_id?: string;
          id?: never;
          moneda?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "equipos_cliente_costos_equipo_cliente_id_fkey";
            columns: ["equipo_cliente_id"];
            isOneToOne: true;
            referencedRelation: "equipos_cliente";
            referencedColumns: ["id"];
          },
        ];
      };
      factura_conceptos: {
        Row: {
          cantidad: number;
          cargo_id: string;
          clave_prod_serv: string | null;
          clave_unidad: string | null;
          created_at: string;
          created_by: string | null;
          descripcion: string;
          factura_id: string;
          id: string;
          importe: number | null;
          iva: number | null;
          iva_tasa: number;
          orden: number;
          precio_unitario: number;
          unidad: string | null;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          cantidad: number;
          cargo_id: string;
          clave_prod_serv?: string | null;
          clave_unidad?: string | null;
          created_at?: string;
          created_by?: string | null;
          descripcion: string;
          factura_id: string;
          id?: string;
          importe?: never;
          iva?: never;
          iva_tasa: number;
          orden?: number;
          precio_unitario: number;
          unidad?: string | null;
          updated_at?: string;
        };
        Update: {
          cantidad?: number;
          cargo_id?: string;
          clave_prod_serv?: string | null;
          clave_unidad?: string | null;
          created_at?: string;
          created_by?: string | null;
          descripcion?: string;
          factura_id?: string;
          id?: string;
          importe?: never;
          iva?: never;
          iva_tasa?: number;
          orden?: number;
          precio_unitario?: number;
          unidad?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "factura_conceptos_cargo_id_fkey";
            columns: ["cargo_id"];
            isOneToOne: false;
            referencedRelation: "cargos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "factura_conceptos_factura_id_fkey";
            columns: ["factura_id"];
            isOneToOne: false;
            referencedRelation: "anticipo_saldos";
            referencedColumns: ["factura_id"];
          },
          {
            foreignKeyName: "factura_conceptos_factura_id_fkey";
            columns: ["factura_id"];
            isOneToOne: false;
            referencedRelation: "factura_saldos";
            referencedColumns: ["factura_id"];
          },
          {
            foreignKeyName: "factura_conceptos_factura_id_fkey";
            columns: ["factura_id"];
            isOneToOne: false;
            referencedRelation: "factura_totales";
            referencedColumns: ["factura_id"];
          },
          {
            foreignKeyName: "factura_conceptos_factura_id_fkey";
            columns: ["factura_id"];
            isOneToOne: false;
            referencedRelation: "facturas";
            referencedColumns: ["id"];
          },
        ];
      };
      facturas: {
        Row: {
          cancelada_at: string | null;
          cancelada_por: string | null;
          created_at: string;
          created_by: string | null;
          cuenta_id: string;
          deleted_at: string | null;
          dias_credito: number;
          emitida_at: string | null;
          emitida_por: string | null;
          es_anticipo: boolean;
          estado: string;
          fecha: string;
          folio: string | null;
          forma_pago: string | null;
          id: string;
          metodo_pago: string | null;
          moneda: string;
          motivo_cancelacion: string | null;
          notas: string | null;
          orden_compra: string | null;
          pdf_ruta: string | null;
          razon_social_id: string;
          serie: string | null;
          timbrado: string | null;
          tipo_cambio: number | null;
          updated_at: string;
          uso_cfdi: string | null;
          uuid_fiscal: string | null;
          xml_ruta: string | null;
          xml_total: number | null;
        };
        ComputedFields: never;
        Insert: {
          cancelada_at?: string | null;
          cancelada_por?: string | null;
          created_at?: string;
          created_by?: string | null;
          cuenta_id: string;
          deleted_at?: string | null;
          dias_credito?: number;
          emitida_at?: string | null;
          emitida_por?: string | null;
          es_anticipo?: boolean;
          estado?: string;
          fecha?: string;
          folio?: string | null;
          forma_pago?: string | null;
          id?: string;
          metodo_pago?: string | null;
          moneda: string;
          motivo_cancelacion?: string | null;
          notas?: string | null;
          orden_compra?: string | null;
          pdf_ruta?: string | null;
          razon_social_id: string;
          serie?: string | null;
          timbrado?: string | null;
          tipo_cambio?: number | null;
          updated_at?: string;
          uso_cfdi?: string | null;
          uuid_fiscal?: string | null;
          xml_ruta?: string | null;
          xml_total?: number | null;
        };
        Update: {
          cancelada_at?: string | null;
          cancelada_por?: string | null;
          created_at?: string;
          created_by?: string | null;
          cuenta_id?: string;
          deleted_at?: string | null;
          dias_credito?: number;
          emitida_at?: string | null;
          emitida_por?: string | null;
          es_anticipo?: boolean;
          estado?: string;
          fecha?: string;
          folio?: string | null;
          forma_pago?: string | null;
          id?: string;
          metodo_pago?: string | null;
          moneda?: string;
          motivo_cancelacion?: string | null;
          notas?: string | null;
          orden_compra?: string | null;
          pdf_ruta?: string | null;
          razon_social_id?: string;
          serie?: string | null;
          timbrado?: string | null;
          tipo_cambio?: number | null;
          updated_at?: string;
          uso_cfdi?: string | null;
          uuid_fiscal?: string | null;
          xml_ruta?: string | null;
          xml_total?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "facturas_cancelada_por_fkey";
            columns: ["cancelada_por"];
            isOneToOne: false;
            referencedRelation: "perfiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "facturas_cuenta_id_fkey";
            columns: ["cuenta_id"];
            isOneToOne: false;
            referencedRelation: "cuentas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "facturas_emitida_por_fkey";
            columns: ["emitida_por"];
            isOneToOne: false;
            referencedRelation: "perfiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "facturas_razon_social_id_cuenta_id_fkey";
            columns: ["razon_social_id", "cuenta_id"];
            isOneToOne: false;
            referencedRelation: "razones_sociales";
            referencedColumns: ["id", "cuenta_id"];
          },
        ];
      };
      fallas: {
        Row: {
          activo: boolean;
          created_at: string;
          created_by: string | null;
          id: string;
          nombre: string;
          orden: number;
          permite_cargo_cliente: boolean;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          activo?: boolean;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          nombre: string;
          orden?: number;
          permite_cargo_cliente?: boolean;
          updated_at?: string;
        };
        Update: {
          activo?: boolean;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          nombre?: string;
          orden?: number;
          permite_cargo_cliente?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
      filtros_instalados: {
        Row: {
          created_at: string;
          created_by: string | null;
          deleted_at: string | null;
          fecha_instalacion: string;
          fecha_retiro: string | null;
          id: string;
          notas: string | null;
          orden_id: string | null;
          parte_id: string;
          robox_id: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          fecha_instalacion: string;
          fecha_retiro?: string | null;
          id?: string;
          notas?: string | null;
          orden_id?: string | null;
          parte_id: string;
          robox_id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          fecha_instalacion?: string;
          fecha_retiro?: string | null;
          id?: string;
          notas?: string | null;
          orden_id?: string | null;
          parte_id?: string;
          robox_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "filtros_instalados_orden_id_fkey";
            columns: ["orden_id"];
            isOneToOne: false;
            referencedRelation: "ordenes_servicio";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "filtros_instalados_parte_id_fkey";
            columns: ["parte_id"];
            isOneToOne: false;
            referencedRelation: "inventario_existencias";
            referencedColumns: ["parte_id"];
          },
          {
            foreignKeyName: "filtros_instalados_parte_id_fkey";
            columns: ["parte_id"];
            isOneToOne: false;
            referencedRelation: "partes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "filtros_instalados_robox_id_fkey";
            columns: ["robox_id"];
            isOneToOne: false;
            referencedRelation: "robox";
            referencedColumns: ["id"];
          },
        ];
      };
      folios_cotizacion: {
        Row: {
          anio: number;
          created_at: string;
          ultimo: number;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          anio: number;
          created_at?: string;
          ultimo?: number;
          updated_at?: string;
        };
        Update: {
          anio?: number;
          created_at?: string;
          ultimo?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      informe_muestras: {
        Row: {
          created_at: string;
          created_by: string | null;
          equipo_cliente_id: string;
          informe_id: string;
          muestra_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by?: string | null;
          equipo_cliente_id: string;
          informe_id: string;
          muestra_id: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          equipo_cliente_id?: string;
          informe_id?: string;
          muestra_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "informe_muestras_informe_id_equipo_cliente_id_fkey";
            columns: ["informe_id", "equipo_cliente_id"];
            isOneToOne: false;
            referencedRelation: "informes";
            referencedColumns: ["id", "equipo_cliente_id"];
          },
          {
            foreignKeyName: "informe_muestras_muestra_id_equipo_cliente_id_fkey";
            columns: ["muestra_id", "equipo_cliente_id"];
            isOneToOne: false;
            referencedRelation: "muestras";
            referencedColumns: ["id", "equipo_cliente_id"];
          },
        ];
      };
      informes: {
        Row: {
          contenido: Json | null;
          created_at: string;
          created_by: string | null;
          cuenta_id: string;
          deleted_at: string | null;
          elaboro_id: string | null;
          equipo_cliente_id: string;
          estado: string;
          fecha_emision: string;
          folio: string;
          id: string;
          observaciones: string | null;
          planta_id: string;
          recomienda_cambio_filtro: boolean;
          updated_at: string;
          validado_at: string | null;
          valido_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          contenido?: Json | null;
          created_at?: string;
          created_by?: string | null;
          cuenta_id: string;
          deleted_at?: string | null;
          elaboro_id?: string | null;
          equipo_cliente_id: string;
          estado?: string;
          fecha_emision?: string;
          folio: string;
          id?: string;
          observaciones?: string | null;
          planta_id: string;
          recomienda_cambio_filtro?: boolean;
          updated_at?: string;
          validado_at?: string | null;
          valido_id?: string | null;
        };
        Update: {
          contenido?: Json | null;
          created_at?: string;
          created_by?: string | null;
          cuenta_id?: string;
          deleted_at?: string | null;
          elaboro_id?: string | null;
          equipo_cliente_id?: string;
          estado?: string;
          fecha_emision?: string;
          folio?: string;
          id?: string;
          observaciones?: string | null;
          planta_id?: string;
          recomienda_cambio_filtro?: boolean;
          updated_at?: string;
          validado_at?: string | null;
          valido_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "informes_cuenta_id_fkey";
            columns: ["cuenta_id"];
            isOneToOne: false;
            referencedRelation: "cuentas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "informes_elaboro_id_fkey";
            columns: ["elaboro_id"];
            isOneToOne: false;
            referencedRelation: "perfiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "informes_equipo_cliente_id_planta_id_fkey";
            columns: ["equipo_cliente_id", "planta_id"];
            isOneToOne: false;
            referencedRelation: "equipos_cliente";
            referencedColumns: ["id", "planta_id"];
          },
          {
            foreignKeyName: "informes_planta_id_cuenta_id_fkey";
            columns: ["planta_id", "cuenta_id"];
            isOneToOne: false;
            referencedRelation: "plantas";
            referencedColumns: ["id", "cuenta_id"];
          },
          {
            foreignKeyName: "informes_valido_id_fkey";
            columns: ["valido_id"];
            isOneToOne: false;
            referencedRelation: "perfiles";
            referencedColumns: ["id"];
          },
        ];
      };
      inventario_movimientos: {
        Row: {
          cantidad: number;
          created_at: string;
          created_by: string | null;
          fecha: string;
          id: string;
          notas: string | null;
          orden_id: string | null;
          parte_id: string;
          referencia: string | null;
          tipo: string;
        };
        ComputedFields: never;
        Insert: {
          cantidad: number;
          created_at?: string;
          created_by?: string | null;
          fecha?: string;
          id?: string;
          notas?: string | null;
          orden_id?: string | null;
          parte_id: string;
          referencia?: string | null;
          tipo: string;
        };
        Update: {
          cantidad?: number;
          created_at?: string;
          created_by?: string | null;
          fecha?: string;
          id?: string;
          notas?: string | null;
          orden_id?: string | null;
          parte_id?: string;
          referencia?: string | null;
          tipo?: string;
        };
        Relationships: [
          {
            foreignKeyName: "inventario_movimientos_orden_id_fkey";
            columns: ["orden_id"];
            isOneToOne: false;
            referencedRelation: "ordenes_servicio";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventario_movimientos_parte_id_fkey";
            columns: ["parte_id"];
            isOneToOne: false;
            referencedRelation: "inventario_existencias";
            referencedColumns: ["parte_id"];
          },
          {
            foreignKeyName: "inventario_movimientos_parte_id_fkey";
            columns: ["parte_id"];
            isOneToOne: false;
            referencedRelation: "partes";
            referencedColumns: ["id"];
          },
        ];
      };
      motivos_perdida: {
        Row: {
          activo: boolean;
          created_at: string;
          created_by: string | null;
          id: string;
          nombre: string;
          orden: number;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          activo?: boolean;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          nombre: string;
          orden?: number;
          updated_at?: string;
        };
        Update: {
          activo?: boolean;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          nombre?: string;
          orden?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      movimientos_robox: {
        Row: {
          asignacion_id: string;
          created_at: string;
          created_by: string | null;
          deleted_at: string | null;
          equipo_destino_id: string;
          equipo_origen_id: string | null;
          fecha: string;
          id: string;
          movido_por: string;
          notas: string | null;
          planta_id: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          asignacion_id: string;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          equipo_destino_id: string;
          equipo_origen_id?: string | null;
          fecha: string;
          id?: string;
          movido_por: string;
          notas?: string | null;
          planta_id: string;
          updated_at?: string;
        };
        Update: {
          asignacion_id?: string;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          equipo_destino_id?: string;
          equipo_origen_id?: string | null;
          fecha?: string;
          id?: string;
          movido_por?: string;
          notas?: string | null;
          planta_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "movimientos_robox_asignacion_id_planta_id_fkey";
            columns: ["asignacion_id", "planta_id"];
            isOneToOne: false;
            referencedRelation: "asignaciones_robox";
            referencedColumns: ["id", "planta_id"];
          },
          {
            foreignKeyName: "movimientos_robox_asignacion_id_planta_id_fkey";
            columns: ["asignacion_id", "planta_id"];
            isOneToOne: false;
            referencedRelation: "robox_ubicacion";
            referencedColumns: ["asignacion_id", "planta_id"];
          },
          {
            foreignKeyName: "movimientos_robox_equipo_destino_id_planta_id_fkey";
            columns: ["equipo_destino_id", "planta_id"];
            isOneToOne: false;
            referencedRelation: "equipos_cliente";
            referencedColumns: ["id", "planta_id"];
          },
          {
            foreignKeyName: "movimientos_robox_equipo_origen_id_planta_id_fkey";
            columns: ["equipo_origen_id", "planta_id"];
            isOneToOne: false;
            referencedRelation: "equipos_cliente";
            referencedColumns: ["id", "planta_id"];
          },
        ];
      };
      muestra_resultados: {
        Row: {
          calificador: string | null;
          created_at: string;
          created_by: string | null;
          id: string;
          muestra_id: string;
          parametro_id: string;
          updated_at: string;
          valor_numerico: number | null;
          valor_texto: string;
        };
        ComputedFields: never;
        Insert: {
          calificador?: never;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          muestra_id: string;
          parametro_id: string;
          updated_at?: string;
          valor_numerico?: never;
          valor_texto: string;
        };
        Update: {
          calificador?: never;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          muestra_id?: string;
          parametro_id?: string;
          updated_at?: string;
          valor_numerico?: never;
          valor_texto?: string;
        };
        Relationships: [
          {
            foreignKeyName: "muestra_resultados_muestra_id_fkey";
            columns: ["muestra_id"];
            isOneToOne: false;
            referencedRelation: "muestras";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "muestra_resultados_parametro_id_fkey";
            columns: ["parametro_id"];
            isOneToOne: false;
            referencedRelation: "parametros_laboratorio";
            referencedColumns: ["id"];
          },
        ];
      };
      muestras: {
        Row: {
          condicion_operacion: string | null;
          created_at: string;
          created_by: string | null;
          cuenta_id: string;
          deleted_at: string | null;
          equipo_cliente_id: string;
          estado: string;
          fecha_muestreo: string;
          fecha_recepcion: string | null;
          id: string;
          id_caso: string | null;
          id_muestra: string;
          nivel_analisis: string | null;
          notas: string | null;
          oportunidad_id: string | null;
          orden_id: string | null;
          planta_id: string;
          punto_muestreo: string | null;
          tipo: string;
          tomada_por: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          condicion_operacion?: string | null;
          created_at?: string;
          created_by?: string | null;
          cuenta_id: string;
          deleted_at?: string | null;
          equipo_cliente_id: string;
          estado?: string;
          fecha_muestreo: string;
          fecha_recepcion?: string | null;
          id?: string;
          id_caso?: string | null;
          id_muestra: string;
          nivel_analisis?: string | null;
          notas?: string | null;
          oportunidad_id?: string | null;
          orden_id?: string | null;
          planta_id: string;
          punto_muestreo?: string | null;
          tipo: string;
          tomada_por?: string;
          updated_at?: string;
        };
        Update: {
          condicion_operacion?: string | null;
          created_at?: string;
          created_by?: string | null;
          cuenta_id?: string;
          deleted_at?: string | null;
          equipo_cliente_id?: string;
          estado?: string;
          fecha_muestreo?: string;
          fecha_recepcion?: string | null;
          id?: string;
          id_caso?: string | null;
          id_muestra?: string;
          nivel_analisis?: string | null;
          notas?: string | null;
          oportunidad_id?: string | null;
          orden_id?: string | null;
          planta_id?: string;
          punto_muestreo?: string | null;
          tipo?: string;
          tomada_por?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "muestras_cuenta_id_fkey";
            columns: ["cuenta_id"];
            isOneToOne: false;
            referencedRelation: "cuentas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "muestras_equipo_cliente_id_planta_id_fkey";
            columns: ["equipo_cliente_id", "planta_id"];
            isOneToOne: false;
            referencedRelation: "equipos_cliente";
            referencedColumns: ["id", "planta_id"];
          },
          {
            foreignKeyName: "muestras_oportunidad_id_cuenta_id_fkey";
            columns: ["oportunidad_id", "cuenta_id"];
            isOneToOne: false;
            referencedRelation: "oportunidades";
            referencedColumns: ["id", "cuenta_id"];
          },
          {
            foreignKeyName: "muestras_orden_id_cuenta_id_fkey";
            columns: ["orden_id", "cuenta_id"];
            isOneToOne: false;
            referencedRelation: "ordenes_servicio";
            referencedColumns: ["id", "cuenta_id"];
          },
          {
            foreignKeyName: "muestras_planta_id_cuenta_id_fkey";
            columns: ["planta_id", "cuenta_id"];
            isOneToOne: false;
            referencedRelation: "plantas";
            referencedColumns: ["id", "cuenta_id"];
          },
        ];
      };
      oportunidad_adjuntos: {
        Row: {
          created_at: string;
          created_by: string | null;
          deleted_at: string | null;
          etapa: string;
          id: string;
          nombre: string;
          oportunidad_id: string;
          ruta: string;
          tamano_bytes: number;
          tipo_mime: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          etapa: string;
          id?: string;
          nombre: string;
          oportunidad_id: string;
          ruta: string;
          tamano_bytes: number;
          tipo_mime: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          etapa?: string;
          id?: string;
          nombre?: string;
          oportunidad_id?: string;
          ruta?: string;
          tamano_bytes?: number;
          tipo_mime?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "oportunidad_adjuntos_oportunidad_id_fkey";
            columns: ["oportunidad_id"];
            isOneToOne: false;
            referencedRelation: "oportunidades";
            referencedColumns: ["id"];
          },
        ];
      };
      oportunidades: {
        Row: {
          canal_venta_id: string | null;
          created_at: string;
          created_by: string | null;
          cuenta_id: string;
          deleted_at: string | null;
          etapa: string;
          fecha_cierre: string | null;
          id: string;
          motivo_perdida: string | null;
          motivo_perdida_id: string | null;
          nombre: string;
          notas: string | null;
          origen: string;
          planta_id: string | null;
          responsable_id: string;
          tipo: string;
          updated_at: string;
          volumen_estimado_l: number | null;
        };
        ComputedFields: never;
        Insert: {
          canal_venta_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          cuenta_id: string;
          deleted_at?: string | null;
          etapa?: string;
          fecha_cierre?: string | null;
          id?: string;
          motivo_perdida?: string | null;
          motivo_perdida_id?: string | null;
          nombre: string;
          notas?: string | null;
          origen: string;
          planta_id?: string | null;
          responsable_id: string;
          tipo: string;
          updated_at?: string;
          volumen_estimado_l?: number | null;
        };
        Update: {
          canal_venta_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          cuenta_id?: string;
          deleted_at?: string | null;
          etapa?: string;
          fecha_cierre?: string | null;
          id?: string;
          motivo_perdida?: string | null;
          motivo_perdida_id?: string | null;
          nombre?: string;
          notas?: string | null;
          origen?: string;
          planta_id?: string | null;
          responsable_id?: string;
          tipo?: string;
          updated_at?: string;
          volumen_estimado_l?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "oportunidades_canal_venta_id_fkey";
            columns: ["canal_venta_id"];
            isOneToOne: false;
            referencedRelation: "canales_venta";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "oportunidades_cuenta_id_fkey";
            columns: ["cuenta_id"];
            isOneToOne: false;
            referencedRelation: "cuentas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "oportunidades_motivo_perdida_id_fkey";
            columns: ["motivo_perdida_id"];
            isOneToOne: false;
            referencedRelation: "motivos_perdida";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "oportunidades_planta_id_cuenta_id_fkey";
            columns: ["planta_id", "cuenta_id"];
            isOneToOne: false;
            referencedRelation: "plantas";
            referencedColumns: ["id", "cuenta_id"];
          },
          {
            foreignKeyName: "oportunidades_responsable_id_fkey";
            columns: ["responsable_id"];
            isOneToOne: false;
            referencedRelation: "perfiles";
            referencedColumns: ["id"];
          },
        ];
      };
      ordenes_compra: {
        Row: {
          contrato_id: string;
          created_at: string;
          created_by: string | null;
          deleted_at: string | null;
          fecha_inicio: string | null;
          fecha_termino: string | null;
          id: string;
          monto: number | null;
          notas: string | null;
          numero: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          contrato_id: string;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          fecha_inicio?: string | null;
          fecha_termino?: string | null;
          id?: string;
          monto?: number | null;
          notas?: string | null;
          numero: string;
          updated_at?: string;
        };
        Update: {
          contrato_id?: string;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          fecha_inicio?: string | null;
          fecha_termino?: string | null;
          id?: string;
          monto?: number | null;
          notas?: string | null;
          numero?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ordenes_compra_contrato_id_fkey";
            columns: ["contrato_id"];
            isOneToOne: false;
            referencedRelation: "contrato_totales";
            referencedColumns: ["contrato_id"];
          },
          {
            foreignKeyName: "ordenes_compra_contrato_id_fkey";
            columns: ["contrato_id"];
            isOneToOne: false;
            referencedRelation: "contratos";
            referencedColumns: ["id"];
          },
        ];
      };
      ordenes_servicio: {
        Row: {
          acompanante_id: string | null;
          contrato_id: string | null;
          created_at: string;
          created_by: string | null;
          cuenta_id: string | null;
          deleted_at: string | null;
          equipo_cliente_id: string | null;
          estado: string;
          fecha_cierre: string | null;
          fecha_programada: string;
          fecha_real: string | null;
          folio: string;
          id: string;
          id_caso: string | null;
          notas: string | null;
          observaciones: string | null;
          planta_id: string | null;
          robox_id: string | null;
          tecnico_id: string;
          temperatura_aceite_c: number | null;
          tipo: string;
          updated_at: string;
          visita_programada_id: string | null;
          volumen_reservorio_l: number | null;
        };
        ComputedFields: never;
        Insert: {
          acompanante_id?: string | null;
          contrato_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          cuenta_id?: string | null;
          deleted_at?: string | null;
          equipo_cliente_id?: string | null;
          estado?: string;
          fecha_cierre?: string | null;
          fecha_programada: string;
          fecha_real?: string | null;
          folio: string;
          id?: string;
          id_caso?: string | null;
          notas?: string | null;
          observaciones?: string | null;
          planta_id?: string | null;
          robox_id?: string | null;
          tecnico_id: string;
          temperatura_aceite_c?: number | null;
          tipo: string;
          updated_at?: string;
          visita_programada_id?: string | null;
          volumen_reservorio_l?: number | null;
        };
        Update: {
          acompanante_id?: string | null;
          contrato_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          cuenta_id?: string | null;
          deleted_at?: string | null;
          equipo_cliente_id?: string | null;
          estado?: string;
          fecha_cierre?: string | null;
          fecha_programada?: string;
          fecha_real?: string | null;
          folio?: string;
          id?: string;
          id_caso?: string | null;
          notas?: string | null;
          observaciones?: string | null;
          planta_id?: string | null;
          robox_id?: string | null;
          tecnico_id?: string;
          temperatura_aceite_c?: number | null;
          tipo?: string;
          updated_at?: string;
          visita_programada_id?: string | null;
          volumen_reservorio_l?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "ordenes_servicio_acompanante_id_fkey";
            columns: ["acompanante_id"];
            isOneToOne: false;
            referencedRelation: "perfiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ordenes_servicio_contrato_id_planta_id_fkey";
            columns: ["contrato_id", "planta_id"];
            isOneToOne: false;
            referencedRelation: "contratos";
            referencedColumns: ["id", "planta_id"];
          },
          {
            foreignKeyName: "ordenes_servicio_cuenta_id_fkey";
            columns: ["cuenta_id"];
            isOneToOne: false;
            referencedRelation: "cuentas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ordenes_servicio_equipo_cliente_id_planta_id_fkey";
            columns: ["equipo_cliente_id", "planta_id"];
            isOneToOne: false;
            referencedRelation: "equipos_cliente";
            referencedColumns: ["id", "planta_id"];
          },
          {
            foreignKeyName: "ordenes_servicio_planta_id_cuenta_id_fkey";
            columns: ["planta_id", "cuenta_id"];
            isOneToOne: false;
            referencedRelation: "plantas";
            referencedColumns: ["id", "cuenta_id"];
          },
          {
            foreignKeyName: "ordenes_servicio_robox_id_fkey";
            columns: ["robox_id"];
            isOneToOne: false;
            referencedRelation: "robox";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ordenes_servicio_tecnico_id_fkey";
            columns: ["tecnico_id"];
            isOneToOne: false;
            referencedRelation: "perfiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ordenes_servicio_visita_programada_id_fkey";
            columns: ["visita_programada_id"];
            isOneToOne: false;
            referencedRelation: "visitas_programadas";
            referencedColumns: ["id"];
          },
        ];
      };
      os_actividades: {
        Row: {
          actividad_id: string;
          cantidad: number | null;
          created_at: string;
          created_by: string | null;
          id: string;
          orden_id: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          actividad_id: string;
          cantidad?: number | null;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          orden_id: string;
          updated_at?: string;
        };
        Update: {
          actividad_id?: string;
          cantidad?: number | null;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          orden_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "os_actividades_actividad_id_fkey";
            columns: ["actividad_id"];
            isOneToOne: false;
            referencedRelation: "actividades";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "os_actividades_orden_id_fkey";
            columns: ["orden_id"];
            isOneToOne: false;
            referencedRelation: "ordenes_servicio";
            referencedColumns: ["id"];
          },
        ];
      };
      os_evidencias: {
        Row: {
          created_at: string;
          created_by: string | null;
          deleted_at: string | null;
          id: string;
          nombre: string;
          orden_id: string;
          ruta: string;
          tamano_bytes: number;
          tipo: string;
          tipo_mime: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          id?: string;
          nombre: string;
          orden_id: string;
          ruta: string;
          tamano_bytes: number;
          tipo: string;
          tipo_mime: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          id?: string;
          nombre?: string;
          orden_id?: string;
          ruta?: string;
          tamano_bytes?: number;
          tipo?: string;
          tipo_mime?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "os_evidencias_orden_id_fkey";
            columns: ["orden_id"];
            isOneToOne: false;
            referencedRelation: "ordenes_servicio";
            referencedColumns: ["id"];
          },
        ];
      };
      os_fallas: {
        Row: {
          created_at: string;
          created_by: string | null;
          falla_id: string;
          id: string;
          orden_id: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by?: string | null;
          falla_id: string;
          id?: string;
          orden_id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          falla_id?: string;
          id?: string;
          orden_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "os_fallas_falla_id_fkey";
            columns: ["falla_id"];
            isOneToOne: false;
            referencedRelation: "fallas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "os_fallas_orden_id_fkey";
            columns: ["orden_id"];
            isOneToOne: false;
            referencedRelation: "ordenes_servicio";
            referencedColumns: ["id"];
          },
        ];
      };
      os_firmas: {
        Row: {
          cargo: string | null;
          created_at: string;
          created_by: string | null;
          fecha: string | null;
          id: string;
          nombre: string;
          orden_id: string;
          rol: string;
          trazos: NonNullable<Json>;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          cargo?: string | null;
          created_at?: string;
          created_by?: string | null;
          fecha?: string | null;
          id?: string;
          nombre: string;
          orden_id: string;
          rol: string;
          trazos: NonNullable<Json>;
          updated_at?: string;
        };
        Update: {
          cargo?: string | null;
          created_at?: string;
          created_by?: string | null;
          fecha?: string | null;
          id?: string;
          nombre?: string;
          orden_id?: string;
          rol?: string;
          trazos?: NonNullable<Json>;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "os_firmas_orden_id_fkey";
            columns: ["orden_id"];
            isOneToOne: false;
            referencedRelation: "ordenes_servicio";
            referencedColumns: ["id"];
          },
        ];
      };
      os_lecturas: {
        Row: {
          ack_flow_l: number | null;
          created_at: string;
          created_by: string | null;
          filter_lifetime_dias: number | null;
          filter_used_dias: number | null;
          flujo_l_min: number | null;
          id: string;
          modelo: string | null;
          momento: string;
          numero_serie: string | null;
          orden_id: string;
          presion_bar: number | null;
          presion_filtro: string | null;
          programa: string | null;
          runtime_dias: number | null;
          temperatura_c: number | null;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          ack_flow_l?: number | null;
          created_at?: string;
          created_by?: string | null;
          filter_lifetime_dias?: number | null;
          filter_used_dias?: number | null;
          flujo_l_min?: number | null;
          id?: string;
          modelo?: string | null;
          momento: string;
          numero_serie?: string | null;
          orden_id: string;
          presion_bar?: number | null;
          presion_filtro?: string | null;
          programa?: string | null;
          runtime_dias?: number | null;
          temperatura_c?: number | null;
          updated_at?: string;
        };
        Update: {
          ack_flow_l?: number | null;
          created_at?: string;
          created_by?: string | null;
          filter_lifetime_dias?: number | null;
          filter_used_dias?: number | null;
          flujo_l_min?: number | null;
          id?: string;
          modelo?: string | null;
          momento?: string;
          numero_serie?: string | null;
          orden_id?: string;
          presion_bar?: number | null;
          presion_filtro?: string | null;
          programa?: string | null;
          runtime_dias?: number | null;
          temperatura_c?: number | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "os_lecturas_orden_id_fkey";
            columns: ["orden_id"];
            isOneToOne: false;
            referencedRelation: "ordenes_servicio";
            referencedColumns: ["id"];
          },
        ];
      };
      os_partes: {
        Row: {
          cantidad: number;
          created_at: string;
          created_by: string | null;
          id: string;
          orden_id: string;
          parte_id: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          cantidad: number;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          orden_id: string;
          parte_id: string;
          updated_at?: string;
        };
        Update: {
          cantidad?: number;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          orden_id?: string;
          parte_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "os_partes_orden_id_fkey";
            columns: ["orden_id"];
            isOneToOne: false;
            referencedRelation: "ordenes_servicio";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "os_partes_parte_id_fkey";
            columns: ["parte_id"];
            isOneToOne: false;
            referencedRelation: "inventario_existencias";
            referencedColumns: ["parte_id"];
          },
          {
            foreignKeyName: "os_partes_parte_id_fkey";
            columns: ["parte_id"];
            isOneToOne: false;
            referencedRelation: "partes";
            referencedColumns: ["id"];
          },
        ];
      };
      pago_aplicaciones: {
        Row: {
          created_at: string;
          created_by: string | null;
          factura_id: string;
          id: string;
          monto: number;
          pago_id: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by?: string | null;
          factura_id: string;
          id?: string;
          monto: number;
          pago_id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          factura_id?: string;
          id?: string;
          monto?: number;
          pago_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "pago_aplicaciones_factura_id_fkey";
            columns: ["factura_id"];
            isOneToOne: false;
            referencedRelation: "anticipo_saldos";
            referencedColumns: ["factura_id"];
          },
          {
            foreignKeyName: "pago_aplicaciones_factura_id_fkey";
            columns: ["factura_id"];
            isOneToOne: false;
            referencedRelation: "factura_saldos";
            referencedColumns: ["factura_id"];
          },
          {
            foreignKeyName: "pago_aplicaciones_factura_id_fkey";
            columns: ["factura_id"];
            isOneToOne: false;
            referencedRelation: "factura_totales";
            referencedColumns: ["factura_id"];
          },
          {
            foreignKeyName: "pago_aplicaciones_factura_id_fkey";
            columns: ["factura_id"];
            isOneToOne: false;
            referencedRelation: "facturas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "pago_aplicaciones_pago_id_fkey";
            columns: ["pago_id"];
            isOneToOne: false;
            referencedRelation: "pago_saldos";
            referencedColumns: ["pago_id"];
          },
          {
            foreignKeyName: "pago_aplicaciones_pago_id_fkey";
            columns: ["pago_id"];
            isOneToOne: false;
            referencedRelation: "pagos";
            referencedColumns: ["id"];
          },
        ];
      };
      pagos: {
        Row: {
          anticipo_factura_id: string | null;
          created_at: string;
          created_by: string | null;
          cuenta_id: string;
          deleted_at: string | null;
          fecha: string;
          forma_pago: string | null;
          id: string;
          moneda: string;
          monto: number;
          notas: string | null;
          razon_social_id: string;
          referencia: string | null;
          rep_folio: string | null;
          rep_uuid: string | null;
          tipo_cambio: number | null;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          anticipo_factura_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          cuenta_id: string;
          deleted_at?: string | null;
          fecha: string;
          forma_pago?: string | null;
          id?: string;
          moneda: string;
          monto: number;
          notas?: string | null;
          razon_social_id: string;
          referencia?: string | null;
          rep_folio?: string | null;
          rep_uuid?: string | null;
          tipo_cambio?: number | null;
          updated_at?: string;
        };
        Update: {
          anticipo_factura_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          cuenta_id?: string;
          deleted_at?: string | null;
          fecha?: string;
          forma_pago?: string | null;
          id?: string;
          moneda?: string;
          monto?: number;
          notas?: string | null;
          razon_social_id?: string;
          referencia?: string | null;
          rep_folio?: string | null;
          rep_uuid?: string | null;
          tipo_cambio?: number | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "pagos_anticipo_factura_id_fkey";
            columns: ["anticipo_factura_id"];
            isOneToOne: false;
            referencedRelation: "anticipo_saldos";
            referencedColumns: ["factura_id"];
          },
          {
            foreignKeyName: "pagos_anticipo_factura_id_fkey";
            columns: ["anticipo_factura_id"];
            isOneToOne: false;
            referencedRelation: "factura_saldos";
            referencedColumns: ["factura_id"];
          },
          {
            foreignKeyName: "pagos_anticipo_factura_id_fkey";
            columns: ["anticipo_factura_id"];
            isOneToOne: false;
            referencedRelation: "factura_totales";
            referencedColumns: ["factura_id"];
          },
          {
            foreignKeyName: "pagos_anticipo_factura_id_fkey";
            columns: ["anticipo_factura_id"];
            isOneToOne: false;
            referencedRelation: "facturas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "pagos_cuenta_id_fkey";
            columns: ["cuenta_id"];
            isOneToOne: false;
            referencedRelation: "cuentas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "pagos_razon_social_id_cuenta_id_fkey";
            columns: ["razon_social_id", "cuenta_id"];
            isOneToOne: false;
            referencedRelation: "razones_sociales";
            referencedColumns: ["id", "cuenta_id"];
          },
        ];
      };
      parametros_laboratorio: {
        Row: {
          activo: boolean;
          base_comparacion: string | null;
          clave: string;
          created_at: string;
          created_by: string | null;
          cuenta_para: string | null;
          en_basico: boolean;
          en_basico_mpc: boolean;
          en_extendido: boolean;
          en_premium: boolean;
          grupo: string;
          id: string;
          limite_texto: string | null;
          limite_valor: number | null;
          metodo: string | null;
          nombre: string;
          orden: number;
          tipo_regla: string;
          unidad: string | null;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          activo?: boolean;
          base_comparacion?: string | null;
          clave: string;
          created_at?: string;
          created_by?: string | null;
          cuenta_para?: string | null;
          en_basico?: boolean;
          en_basico_mpc?: boolean;
          en_extendido?: boolean;
          en_premium?: boolean;
          grupo: string;
          id?: string;
          limite_texto?: string | null;
          limite_valor?: number | null;
          metodo?: string | null;
          nombre: string;
          orden?: number;
          tipo_regla: string;
          unidad?: string | null;
          updated_at?: string;
        };
        Update: {
          activo?: boolean;
          base_comparacion?: string | null;
          clave?: string;
          created_at?: string;
          created_by?: string | null;
          cuenta_para?: string | null;
          en_basico?: boolean;
          en_basico_mpc?: boolean;
          en_extendido?: boolean;
          en_premium?: boolean;
          grupo?: string;
          id?: string;
          limite_texto?: string | null;
          limite_valor?: number | null;
          metodo?: string | null;
          nombre?: string;
          orden?: number;
          tipo_regla?: string;
          unidad?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      parametros_negocio: {
        Row: {
          clave: string;
          created_at: string;
          created_by: string | null;
          descripcion: string;
          id: string;
          moneda: string | null;
          unidad: string;
          updated_at: string;
          valor: number;
        };
        ComputedFields: never;
        Insert: {
          clave: string;
          created_at?: string;
          created_by?: string | null;
          descripcion: string;
          id?: string;
          moneda?: string | null;
          unidad: string;
          updated_at?: string;
          valor: number;
        };
        Update: {
          clave?: string;
          created_at?: string;
          created_by?: string | null;
          descripcion?: string;
          id?: string;
          moneda?: string | null;
          unidad?: string;
          updated_at?: string;
          valor?: number;
        };
        Relationships: [];
      };
      partes: {
        Row: {
          activo: boolean;
          created_at: string;
          created_by: string | null;
          es_filtro: boolean;
          id: string;
          nombre: string;
          notas: string | null;
          orden: number;
          tipo: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          activo?: boolean;
          created_at?: string;
          created_by?: string | null;
          es_filtro?: boolean;
          id?: string;
          nombre: string;
          notas?: string | null;
          orden?: number;
          tipo: string;
          updated_at?: string;
        };
        Update: {
          activo?: boolean;
          created_at?: string;
          created_by?: string | null;
          es_filtro?: boolean;
          id?: string;
          nombre?: string;
          notas?: string | null;
          orden?: number;
          tipo?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      perfiles: {
        Row: {
          activo: boolean;
          correo: string;
          created_at: string;
          created_by: string | null;
          id: string;
          nombre: string;
          puesto: string | null;
          rol_id: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          activo?: boolean;
          correo: string;
          created_at?: string;
          created_by?: string | null;
          id: string;
          nombre: string;
          puesto?: string | null;
          rol_id: string;
          updated_at?: string;
        };
        Update: {
          activo?: boolean;
          correo?: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          nombre?: string;
          puesto?: string | null;
          rol_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "perfiles_rol_id_fkey";
            columns: ["rol_id"];
            isOneToOne: false;
            referencedRelation: "roles";
            referencedColumns: ["id"];
          },
        ];
      };
      permisos: {
        Row: {
          clave: string;
          created_at: string;
          created_by: string | null;
          descripcion: string;
          id: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          clave: string;
          created_at?: string;
          created_by?: string | null;
          descripcion: string;
          id?: string;
          updated_at?: string;
        };
        Update: {
          clave?: string;
          created_at?: string;
          created_by?: string | null;
          descripcion?: string;
          id?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      plantas: {
        Row: {
          calle: string | null;
          codigo_postal: string | null;
          colonia: string | null;
          created_at: string;
          created_by: string | null;
          cuenta_id: string;
          deleted_at: string | null;
          estado: string | null;
          id: string;
          municipio: string | null;
          nombre: string;
          numero_exterior: string | null;
          numero_interior: string | null;
          razon_social_id: string | null;
          referencia: string | null;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          calle?: string | null;
          codigo_postal?: string | null;
          colonia?: string | null;
          created_at?: string;
          created_by?: string | null;
          cuenta_id: string;
          deleted_at?: string | null;
          estado?: string | null;
          id?: string;
          municipio?: string | null;
          nombre: string;
          numero_exterior?: string | null;
          numero_interior?: string | null;
          razon_social_id?: string | null;
          referencia?: string | null;
          updated_at?: string;
        };
        Update: {
          calle?: string | null;
          codigo_postal?: string | null;
          colonia?: string | null;
          created_at?: string;
          created_by?: string | null;
          cuenta_id?: string;
          deleted_at?: string | null;
          estado?: string | null;
          id?: string;
          municipio?: string | null;
          nombre?: string;
          numero_exterior?: string | null;
          numero_interior?: string | null;
          razon_social_id?: string | null;
          referencia?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "plantas_cuenta_id_fkey";
            columns: ["cuenta_id"];
            isOneToOne: false;
            referencedRelation: "cuentas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "plantas_razon_social_fkey";
            columns: ["razon_social_id", "cuenta_id"];
            isOneToOne: false;
            referencedRelation: "razones_sociales";
            referencedColumns: ["id", "cuenta_id"];
          },
        ];
      };
      portal_proveedor: {
        Row: {
          created_at: string;
          created_by: string | null;
          estado: string;
          factura_id: string;
          fecha_aprobacion: string | null;
          fecha_pago_programado: string | null;
          fecha_subida: string | null;
          id: string | null;
          notas: string | null;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by?: string | null;
          estado?: string;
          factura_id: string;
          fecha_aprobacion?: string | null;
          fecha_pago_programado?: string | null;
          fecha_subida?: string | null;
          id?: never;
          notas?: string | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          estado?: string;
          factura_id?: string;
          fecha_aprobacion?: string | null;
          fecha_pago_programado?: string | null;
          fecha_subida?: string | null;
          id?: never;
          notas?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "portal_proveedor_factura_id_fkey";
            columns: ["factura_id"];
            isOneToOne: true;
            referencedRelation: "anticipo_saldos";
            referencedColumns: ["factura_id"];
          },
          {
            foreignKeyName: "portal_proveedor_factura_id_fkey";
            columns: ["factura_id"];
            isOneToOne: true;
            referencedRelation: "factura_saldos";
            referencedColumns: ["factura_id"];
          },
          {
            foreignKeyName: "portal_proveedor_factura_id_fkey";
            columns: ["factura_id"];
            isOneToOne: true;
            referencedRelation: "factura_totales";
            referencedColumns: ["factura_id"];
          },
          {
            foreignKeyName: "portal_proveedor_factura_id_fkey";
            columns: ["factura_id"];
            isOneToOne: true;
            referencedRelation: "facturas";
            referencedColumns: ["id"];
          },
        ];
      };
      razones_sociales: {
        Row: {
          codigo_postal_fiscal: string | null;
          created_at: string;
          created_by: string | null;
          cuenta_id: string;
          deleted_at: string | null;
          id: string;
          notas: string | null;
          razon_social: string;
          regimen_fiscal: string | null;
          rfc: string;
          updated_at: string;
          usa_portal_proveedores: boolean;
          uso_cfdi: string | null;
        };
        ComputedFields: never;
        Insert: {
          codigo_postal_fiscal?: string | null;
          created_at?: string;
          created_by?: string | null;
          cuenta_id: string;
          deleted_at?: string | null;
          id?: string;
          notas?: string | null;
          razon_social: string;
          regimen_fiscal?: string | null;
          rfc: string;
          updated_at?: string;
          usa_portal_proveedores?: boolean;
          uso_cfdi?: string | null;
        };
        Update: {
          codigo_postal_fiscal?: string | null;
          created_at?: string;
          created_by?: string | null;
          cuenta_id?: string;
          deleted_at?: string | null;
          id?: string;
          notas?: string | null;
          razon_social?: string;
          regimen_fiscal?: string | null;
          rfc?: string;
          updated_at?: string;
          usa_portal_proveedores?: boolean;
          uso_cfdi?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "razones_sociales_cuenta_id_fkey";
            columns: ["cuenta_id"];
            isOneToOne: false;
            referencedRelation: "cuentas";
            referencedColumns: ["id"];
          },
        ];
      };
      requisitos_planta: {
        Row: {
          categoria: string;
          created_at: string;
          created_by: string | null;
          deleted_at: string | null;
          detalle: string | null;
          id: string;
          nombre: string;
          planta_id: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          categoria: string;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          detalle?: string | null;
          id?: string;
          nombre: string;
          planta_id: string;
          updated_at?: string;
        };
        Update: {
          categoria?: string;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          detalle?: string | null;
          id?: string;
          nombre?: string;
          planta_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "requisitos_planta_planta_id_fkey";
            columns: ["planta_id"];
            isOneToOne: false;
            referencedRelation: "plantas";
            referencedColumns: ["id"];
          },
        ];
      };
      robox: {
        Row: {
          created_at: string;
          created_by: string | null;
          deleted_at: string | null;
          estado: string;
          fecha_alta: string | null;
          id: string;
          modelo: string | null;
          notas: string | null;
          numero_serie: string;
          sim: string | null;
          updated_at: string;
          version_programa: string | null;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          estado?: string;
          fecha_alta?: string | null;
          id?: string;
          modelo?: string | null;
          notas?: string | null;
          numero_serie: string;
          sim?: string | null;
          updated_at?: string;
          version_programa?: string | null;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          estado?: string;
          fecha_alta?: string | null;
          id?: string;
          modelo?: string | null;
          notas?: string | null;
          numero_serie?: string;
          sim?: string | null;
          updated_at?: string;
          version_programa?: string | null;
        };
        Relationships: [];
      };
      rol_permisos: {
        Row: {
          created_at: string;
          created_by: string | null;
          id: string;
          permiso_id: string;
          rol_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          permiso_id: string;
          rol_id: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          permiso_id?: string;
          rol_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "rol_permisos_permiso_id_fkey";
            columns: ["permiso_id"];
            isOneToOne: false;
            referencedRelation: "permisos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "rol_permisos_rol_id_fkey";
            columns: ["rol_id"];
            isOneToOne: false;
            referencedRelation: "roles";
            referencedColumns: ["id"];
          },
        ];
      };
      roles: {
        Row: {
          clave: string;
          created_at: string;
          created_by: string | null;
          descripcion: string;
          es_interno: boolean;
          id: string;
          nombre: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          clave: string;
          created_at?: string;
          created_by?: string | null;
          descripcion: string;
          es_interno?: boolean;
          id?: string;
          nombre: string;
          updated_at?: string;
        };
        Update: {
          clave?: string;
          created_at?: string;
          created_by?: string | null;
          descripcion?: string;
          es_interno?: boolean;
          id?: string;
          nombre?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      tipos_documento_acceso: {
        Row: {
          activo: boolean;
          aplica_a: string;
          created_at: string;
          created_by: string | null;
          id: string;
          nombre: string;
          orden: number;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          activo?: boolean;
          aplica_a: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          nombre: string;
          orden?: number;
          updated_at?: string;
        };
        Update: {
          activo?: boolean;
          aplica_a?: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          nombre?: string;
          orden?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      visitas_programadas: {
        Row: {
          activa: boolean;
          cada_cantidad: number;
          cada_unidad: string;
          contrato_id: string;
          created_at: string;
          created_by: string | null;
          deleted_at: string | null;
          equipo_cliente_id: string | null;
          id: string;
          notas: string | null;
          planta_id: string;
          proxima_fecha: string;
          robox_id: string | null;
          tecnico_id: string | null;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          activa?: boolean;
          cada_cantidad: number;
          cada_unidad: string;
          contrato_id: string;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          equipo_cliente_id?: string | null;
          id?: string;
          notas?: string | null;
          planta_id: string;
          proxima_fecha: string;
          robox_id?: string | null;
          tecnico_id?: string | null;
          updated_at?: string;
        };
        Update: {
          activa?: boolean;
          cada_cantidad?: number;
          cada_unidad?: string;
          contrato_id?: string;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          equipo_cliente_id?: string | null;
          id?: string;
          notas?: string | null;
          planta_id?: string;
          proxima_fecha?: string;
          robox_id?: string | null;
          tecnico_id?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "visitas_programadas_contrato_id_planta_id_fkey";
            columns: ["contrato_id", "planta_id"];
            isOneToOne: false;
            referencedRelation: "contratos";
            referencedColumns: ["id", "planta_id"];
          },
          {
            foreignKeyName: "visitas_programadas_equipo_cliente_id_planta_id_fkey";
            columns: ["equipo_cliente_id", "planta_id"];
            isOneToOne: false;
            referencedRelation: "equipos_cliente";
            referencedColumns: ["id", "planta_id"];
          },
          {
            foreignKeyName: "visitas_programadas_robox_id_fkey";
            columns: ["robox_id"];
            isOneToOne: false;
            referencedRelation: "robox";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "visitas_programadas_tecnico_id_fkey";
            columns: ["tecnico_id"];
            isOneToOne: false;
            referencedRelation: "perfiles";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      anticipo_saldos: {
        Row: {
          aplicado: number | null;
          cuenta_id: string;
          disponible: number | null;
          factura_id: string;
          moneda: string;
          pagado: number | null;
          razon_social_id: string;
        };
        ComputedFields: never;
        Relationships: [
          {
            foreignKeyName: "facturas_cuenta_id_fkey";
            columns: ["cuenta_id"];
            isOneToOne: false;
            referencedRelation: "cuentas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "facturas_razon_social_id_cuenta_id_fkey";
            columns: ["razon_social_id", "cuenta_id"];
            isOneToOne: false;
            referencedRelation: "razones_sociales";
            referencedColumns: ["id", "cuenta_id"];
          },
        ];
      };
      contrato_totales: {
        Row: {
          contrato_id: string;
          tarifas: number | null;
          total_mensual: number | null;
          total_unico: number | null;
        };
        ComputedFields: never;
        Relationships: [];
      };
      cotizacion_totales: {
        Row: {
          cotizacion_id: string;
          partidas: number | null;
          total_recurrente: number | null;
          total_unico: number | null;
        };
        ComputedFields: never;
        Relationships: [];
      };
      factura_saldos: {
        Row: {
          factura_id: string;
          pagado: number | null;
          saldo: number | null;
          total: number | null;
        };
        ComputedFields: never;
        Relationships: [];
      };
      factura_totales: {
        Row: {
          conceptos: number | null;
          factura_id: string;
          iva: number | null;
          subtotal: number | null;
          total: number | null;
        };
        ComputedFields: never;
        Relationships: [];
      };
      inventario_existencias: {
        Row: {
          existencia: number | null;
          parte_id: string;
          ultimo_movimiento: string | null;
        };
        ComputedFields: never;
        Relationships: [];
      };
      orden_compra_saldos: {
        Row: {
          contrato_id: string;
          facturado: number | null;
          monto: number | null;
          orden_compra_id: string;
          saldo: number | null;
        };
        ComputedFields: never;
        Relationships: [
          {
            foreignKeyName: "ordenes_compra_contrato_id_fkey";
            columns: ["contrato_id"];
            isOneToOne: false;
            referencedRelation: "contrato_totales";
            referencedColumns: ["contrato_id"];
          },
          {
            foreignKeyName: "ordenes_compra_contrato_id_fkey";
            columns: ["contrato_id"];
            isOneToOne: false;
            referencedRelation: "contratos";
            referencedColumns: ["id"];
          },
        ];
      };
      pago_saldos: {
        Row: {
          aplicado: number | null;
          pago_id: string;
          por_aplicar: number | null;
        };
        ComputedFields: never;
        Relationships: [];
      };
      robox_ubicacion: {
        Row: {
          asignacion_id: string;
          contrato_id: string;
          cuenta_id: string;
          equipo_cliente_id: string | null;
          fecha_inicio: string;
          planta_id: string;
          robox_id: string;
        };
        ComputedFields: never;
        Relationships: [
          {
            foreignKeyName: "asignaciones_robox_contrato_id_planta_id_fkey";
            columns: ["contrato_id", "planta_id"];
            isOneToOne: false;
            referencedRelation: "contratos";
            referencedColumns: ["id", "planta_id"];
          },
          {
            foreignKeyName: "asignaciones_robox_robox_id_fkey";
            columns: ["robox_id"];
            isOneToOne: false;
            referencedRelation: "robox";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "contratos_cuenta_id_fkey";
            columns: ["cuenta_id"];
            isOneToOne: false;
            referencedRelation: "cuentas";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Functions: {
      ajustar_existencia: {
        Args: { p_contada: number; p_notas?: string; p_parte: string };
        Returns: number;
      };
      aplicar_anticipo: {
        Args: {
          p_anticipo: string;
          p_factura: string;
          p_fecha: string;
          p_monto: number;
        };
        Returns: string;
      };
      crear_factura: {
        Args: { p_cargos: string[]; p_razon_social: string };
        Returns: string;
      };
      directorio_comercial: {
        Args: Record<PropertyKey, never>;
        Returns: {
          asignable: boolean;
          id: string;
          nombre: string;
        }[];
      };
      directorio_tecnicos: {
        Args: Record<PropertyKey, never>;
        Returns: {
          asignable: boolean;
          id: string;
          nombre: string;
        }[];
      };
      documento_aviso_dias: {
        Args: Record<PropertyKey, never>;
        Returns: number;
      };
      filtro_cambio_meses: {
        Args: Record<PropertyKey, never>;
        Returns: number;
      };
      generar_cargo_unico: { Args: { p_tarifa: string }; Returns: string };
      generar_rentas_mes: { Args: { p_periodo: string }; Returns: number };
      guardar_captura_orden: {
        Args: { p_captura: Json; p_orden: string };
        Returns: undefined;
      };
      guardar_resultados_muestra: {
        Args: { p_muestra: string; p_resultados: Json };
        Returns: undefined;
      };
      iva_tasa: { Args: Record<PropertyKey, never>; Returns: number };
      mi_rol_id: { Args: Record<PropertyKey, never>; Returns: string };
      mis_permisos: { Args: Record<PropertyKey, never>; Returns: string[] };
      pagos_unicos_de_contrato: {
        Args: { p_contrato: string };
        Returns: {
          cargo_estado: string;
          cargo_id: string;
          concepto: string;
          es_anticipo: boolean;
          moneda: string;
          precio: number;
          tarifa_id: string;
        }[];
      };
      programar_visita: {
        Args: { p_tecnico?: string; p_visita: string };
        Returns: string;
      };
      puede_llenar_orden: { Args: { p_orden: string }; Returns: boolean };
      registrar_pago: {
        Args: { p_aplicaciones: Json; p_datos: Json; p_razon_social: string };
        Returns: string;
      };
      rentas_del_mes: {
        Args: { p_periodo: string };
        Returns: {
          cargo_estado: string;
          cargo_id: string;
          concepto: string;
          contrato_id: string;
          cuenta: string;
          cuenta_id: string;
          moneda: string;
          orden_compra_id: string;
          parcial: boolean;
          planta: string;
          precio: number;
          tarifa_id: string;
        }[];
      };
      siguiente_folio_cotizacion: {
        Args: Record<PropertyKey, never>;
        Returns: string;
      };
      tiene_permiso: { Args: { p_clave: string }; Returns: boolean };
      umbrales_condicion_aceite: {
        Args: Record<PropertyKey, never>;
        Returns: {
          critico_desde: number;
          precaucion_desde: number;
        }[];
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
