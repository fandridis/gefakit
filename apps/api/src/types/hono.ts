import { Kysely } from "kysely";
import { DB } from "../db/db-types";

export interface Bindings extends Cloudflare.Env {
    myVar: string;
  }
  
  export interface Variables {
    db: Kysely<DB>
  }