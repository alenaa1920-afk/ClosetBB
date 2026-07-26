/**
 * Types for the schema in `supabase/migrations/0001_init.sql`.
 *
 * Hand-maintained so the repo type-checks without a running database. If you
 * change the migration, mirror it here (or regenerate with
 * `supabase gen types typescript --project-id <id>`).
 */

export type Json =
  string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type ProductRow = {
  id: string;
  user_id: string;
  title: string;
  brand: string | null;
  store: string;
  category: string;
  price: number | null;
  original_price: number | null;
  currency: string;
  discount: number | null;
  image_url: string | null;
  product_url: string | null;
  size: string | null;
  sizes_available: string[];
  color: string | null;
  quantity: number | null;
  seller: string | null;
  rating: number | null;
  rating_count: number | null;
  sku: string | null;
  availability: string | null;
  note: string | null;
  tracking: boolean;
  last_checked_at: string | null;
  created_at: string;
  updated_at: string;
};

type ProductInsert = {
  id?: string;
  user_id: string;
  title: string;
  brand?: string | null;
  store?: string;
  category?: string;
  price?: number | null;
  original_price?: number | null;
  currency?: string;
  discount?: number | null;
  image_url?: string | null;
  product_url?: string | null;
  size?: string | null;
  sizes_available?: string[];
  color?: string | null;
  quantity?: number | null;
  seller?: string | null;
  rating?: number | null;
  rating_count?: number | null;
  sku?: string | null;
  availability?: string | null;
  note?: string | null;
  tracking?: boolean;
  last_checked_at?: string | null;
  created_at?: string;
  updated_at?: string;
};

type CollectionRow = {
  id: string;
  user_id: string;
  name: string;
  emoji: string | null;
  created_at: string;
  updated_at: string;
};

export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string | null;
          display_name: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          email?: string | null;
          display_name?: string | null;
          created_at?: string;
        };
        Update: {
          email?: string | null;
          display_name?: string | null;
        };
        Relationships: [];
      };
      stores: {
        Row: {
          key: string;
          label: string;
          color: string;
          color_dark: string | null;
          gradient_from: string | null;
          gradient_to: string | null;
          home: string | null;
          extension_status: string;
        };
        Insert: {
          key: string;
          label: string;
          color: string;
          color_dark?: string | null;
          gradient_from?: string | null;
          gradient_to?: string | null;
          home?: string | null;
          extension_status?: string;
        };
        Update: Partial<{
          label: string;
          color: string;
          color_dark: string | null;
          gradient_from: string | null;
          gradient_to: string | null;
          home: string | null;
          extension_status: string;
        }>;
        Relationships: [];
      };
      products: {
        Row: ProductRow;
        Insert: ProductInsert;
        Update: Partial<Omit<ProductInsert, "user_id">>;
        Relationships: [];
      };
      collections: {
        Row: CollectionRow;
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          emoji?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<{ name: string; emoji: string | null; updated_at: string }>;
        Relationships: [];
      };
      collection_products: {
        Row: { collection_id: string; product_id: string; added_at: string };
        Insert: { collection_id: string; product_id: string; added_at?: string };
        Update: Partial<{ added_at: string }>;
        Relationships: [];
      };
      favorites: {
        Row: { user_id: string; product_id: string; created_at: string };
        Insert: { user_id: string; product_id: string; created_at?: string };
        Update: Partial<{ created_at: string }>;
        Relationships: [];
      };
      price_history: {
        Row: {
          id: number;
          product_id: string;
          price: number;
          recorded_at: string;
        };
        Insert: { product_id: string; price: number; recorded_at?: string };
        Update: Partial<{ price: number; recorded_at: string }>;
        Relationships: [];
      };
    };
    Views: {
      products_expanded: {
        Row: ProductRow & {
          favorite: boolean;
          collection_ids: string[] | null;
          price_history: Json;
        };
        Relationships: [];
      };
    };
    Functions: { [_ in never]: never };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};

export type ProductExpandedRow =
  Database["public"]["Views"]["products_expanded"]["Row"];
export type CollectionTableRow = Database["public"]["Tables"]["collections"]["Row"];
