import { ColumnType, GeneratedAlways, Insertable } from "kysely";

type Author = {
    id: number;
    username: string;
    email: string;
    avatar_url?: string;
}

interface AuthorTable {
    id: GeneratedAlways<number>
    username: string
    email: string
    avatar_url?: string
   // modified_at: ColumnType<Date, string, never>
  }

type InsertableAuthor = Insertable<AuthorTable>

type Post = {
    id: number;
    title: string;
    content: string;
    author_id: number;
}

type Comment = {
    id: number;
    post_id: number;
    content: string;
}

type Like = {
    id: number;
    post_id: number;
    user_id: number;
}

export interface Database {
    authors: AuthorTable;
    posts: Post;
    comments: Comment;
    likes: Like;
}
