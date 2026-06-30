import { getDatabaseConnection, initDb } from './database.js';

async function forceSeed() {
    console.log("Conectando a la base de datos para limpiar tablas...");
    const db = await getDatabaseConnection();
    
    // Desactivar llaves foráneas temporalmente para poder limpiar
    await db.run('PRAGMA foreign_keys = OFF');
    
    // Limpiar tablas existentes
    await db.run('DROP TABLE IF EXISTS settings');
    await db.run('DROP TABLE IF EXISTS services');
    await db.run('DROP TABLE IF EXISTS therapists');
    await db.run('DROP TABLE IF EXISTS exceptions');
    await db.run('DROP TABLE IF EXISTS bookings');
    
    console.log("Tablas limpiadas. Ejecutando inicialización y siembra de datos...");
    await initDb();
    
    await db.close();
    console.log("¡Base de datos sembrada con éxito!");
}

forceSeed().catch(err => {
    console.error("Error al sembrar la base de datos:", err);
});
