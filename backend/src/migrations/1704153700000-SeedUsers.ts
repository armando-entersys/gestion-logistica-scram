import { MigrationInterface, QueryRunner } from 'typeorm';
import * as argon2 from 'argon2';

/**
 * Seed de usuarios de prueba según MD050 - Matriz de Roles y Seguridad
 *
 * Roles definidos:
 * 1. PURCHASING - Analista de Compras (Noemi)
 * 2. ADMIN - Jefe de Tráfico (Karla)
 * 3. DRIVER - Chofer Operativo (Juan)
 * 4. SALES - Ventas/Comercial (Vendedores)
 * 5. DIRECTOR - Dirección (Gerencia)
 */
export class SeedUsers1704153700000 implements MigrationInterface {
  name = 'SeedUsers1704153700000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Contraseña común para demo: scram2024
    // ¡CAMBIAR EN PRODUCCIÓN!
    const defaultPassword = await argon2.hash('scram2024');

    // =============================================
    // ROL 1: ANALISTA DE COMPRAS (PURCHASING)
    // Permisos: Sincronizar Bind, Validar existencia, Liberar pedidos
    // Restricciones: NO puede ver/modificar Rutas, NO puede asignar Choferes
    // =============================================
    await queryRunner.query(`
      INSERT INTO "users" (
        "email", "password_hash", "first_name", "last_name",
        "role_code", "phone", "is_active"
      ) VALUES (
        'noemi@scram.local',
        '${defaultPassword}',
        'Noemi',
        'Agustin',
        'PURCHASING',
        '5551000001',
        true
      )
    `);

    // =============================================
    // ROL 2: JEFE DE TRÁFICO (ADMIN)
    // Permisos: Visualizar Mapa, Asignar Choferes, Iniciar Despacho, Gestión Usuarios
    // Restricciones: NO puede sincronizar, NO puede editar montos financieros
    // =============================================
    await queryRunner.query(`
      INSERT INTO "users" (
        "email", "password_hash", "first_name", "last_name",
        "role_code", "phone", "is_active"
      ) VALUES (
        'karla@scram.local',
        '${defaultPassword}',
        'Karla',
        'Martinez',
        'ADMIN',
        '5551000002',
        true
      )
    `);

    // =============================================
    // ROL 3: CHOFER OPERATIVO (DRIVER)
    // Permisos: App Móvil (solo su ruta), Botones Maps/Llamar, Captura POD
    // Restricciones: NO ve montos ($), NO ve rutas de otros, NO ve historial
    // =============================================
    await queryRunner.query(`
      INSERT INTO "users" (
        "email", "password_hash", "first_name", "last_name",
        "role_code", "phone", "is_active"
      ) VALUES (
        'juan@scram.local',
        '${defaultPassword}',
        'Juan',
        'Perez',
        'DRIVER',
        '5551000003',
        true
      )
    `);

    // Chofer adicional para pruebas de múltiples rutas
    await queryRunner.query(`
      INSERT INTO "users" (
        "email", "password_hash", "first_name", "last_name",
        "role_code", "phone", "is_active"
      ) VALUES (
        'pedro@scram.local',
        '${defaultPassword}',
        'Pedro',
        'Garcia',
        'DRIVER',
        '5551000004',
        true
      )
    `);

    // =============================================
    // ROL 4: VENTAS / COMERCIAL (SALES)
    // Permisos: Consultar Estatus (Solo lectura), Crear Reseña Interna, Ver Evidencia
    // Restricciones: SOLO LECTURA, Sin permisos de edición operativa
    // =============================================
    await queryRunner.query(`
      INSERT INTO "users" (
        "email", "password_hash", "first_name", "last_name",
        "role_code", "phone", "is_active"
      ) VALUES (
        'ventas1@scram.local',
        '${defaultPassword}',
        'Maria',
        'Lopez',
        'SALES',
        '5551000005',
        true
      )
    `);

    await queryRunner.query(`
      INSERT INTO "users" (
        "email", "password_hash", "first_name", "last_name",
        "role_code", "phone", "is_active"
      ) VALUES (
        'ventas2@scram.local',
        '${defaultPassword}',
        'Carlos',
        'Hernandez',
        'SALES',
        '5551000006',
        true
      )
    `);

    // =============================================
    // ROL 5: DIRECCIÓN (DIRECTOR)
    // Permisos: Dashboard Global de KPIs, Reportes Financieros
    // Restricciones: Solo Lectura
    // =============================================
    await queryRunner.query(`
      INSERT INTO "users" (
        "email", "password_hash", "first_name", "last_name",
        "role_code", "phone", "is_active"
      ) VALUES (
        'direccion@scram.local',
        '${defaultPassword}',
        'Roberto',
        'Sanchez',
        'DIRECTOR',
        '5551000007',
        true
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM "users"
      WHERE "email" IN (
        'noemi@scram.local',
        'karla@scram.local',
        'juan@scram.local',
        'pedro@scram.local',
        'ventas1@scram.local',
        'ventas2@scram.local',
        'direccion@scram.local'
      )
    `);
  }
}
