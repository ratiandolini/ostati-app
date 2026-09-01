declare const process: {
  env: {
    NODE_ENV?: string;
    REACT_APP_DATA_MODE?: string;
    REACT_APP_AUTH_MODE?: string;
    REACT_APP_SUPABASE_URL?: string;
    REACT_APP_SUPABASE_ANON_KEY?: string;
  };
};

declare module "scheduler/tracing" {
  export interface Interaction {
    id: number;
    name: string;
    timestamp: number;
  }
}
