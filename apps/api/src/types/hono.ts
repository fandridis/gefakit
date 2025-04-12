import { Kysely } from 'kysely';
import { Database } from '../db/types';

export interface Bindings extends Cloudflare.Env {
    myVar: string;
  }
  
  export interface Variables {
    db: Kysely<Database>
  }