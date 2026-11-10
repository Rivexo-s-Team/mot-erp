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
      parametros_laboratorio: {
        Row: {
          activo: boolean;
          base_comparacion: string | null;
          clave: string;
          created_at: string;
          created_by: string | null;
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
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      mi_rol_id: { Args: Record<PropertyKey, never>; Returns: string };
      mis_permisos: { Args: Record<PropertyKey, never>; Returns: string[] };
      tiene_permiso: { Args: { p_clave: string }; Returns: boolean };
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
