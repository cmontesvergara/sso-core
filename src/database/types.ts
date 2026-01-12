/**
 * Database connection configuration and management
 */
export interface DatabaseConfig {
  type: 'mysql' | 'postgresql' | 'sqlite';
  host?: string;
  port?: number;
  name: string;
  user?: string;
  password?: string;
  ssl?: boolean;
}

export interface QueryBuilder {
  select(...fields: string[]): QueryBuilder;
  from(table: string): QueryBuilder;
  where(condition: string, ...params: any[]): QueryBuilder;
  orderBy(field: string, direction?: 'ASC' | 'DESC'): QueryBuilder;
  limit(count: number): QueryBuilder;
  offset(count: number): QueryBuilder;
  execute(): Promise<any[]>;
  executeOne(): Promise<any>;
  count(): Promise<number>;
}

export interface DatabaseConnection {
  query(sql: string, params?: any[]): Promise<any[]>;
  queryOne(sql: string, params?: any[]): Promise<any>;
  insert(table: string, data: Record<string, any>): Promise<any>;
  update(table: string, data: Record<string, any>, where: Record<string, any>): Promise<void>;
  delete(table: string, where: Record<string, any>): Promise<void>;
  transaction(callback: (db: DatabaseConnection) => Promise<void>): Promise<void>;
  close(): Promise<void>;
}

export interface Repository<T> {
  create(data: Partial<T>): Promise<T>;
  findById(id: string): Promise<T | null>;
  findAll(limit?: number, offset?: number): Promise<T[]>;
  findOne(where: Partial<T>): Promise<T | null>;
  findMany(where: Partial<T>): Promise<T[]>;
  update(id: string, data: Partial<T>): Promise<T>;
  delete(id: string): Promise<void>;
}
