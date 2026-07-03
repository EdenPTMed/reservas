import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = process.env.DATABASE_PATH || path.join(__dirname, 'eden_spa.db');

// Asegurar que la carpeta padre de la base de datos exista (por ejemplo, si se monta un volumen en Docker/Coolify)
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}

export async function getDatabaseConnection() {
    return open({
        filename: dbPath,
        driver: sqlite3.Database
    });
}

export async function initDb() {
    const dbExists = fs.existsSync(dbPath);

    const db = await getDatabaseConnection();

    // Enable foreign keys
    await db.run('PRAGMA foreign_keys = ON');

    // Create tables
    await db.exec(`
        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS services (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            duration INTEGER NOT NULL,
            price REAL NOT NULL,
            desc TEXT,
            category TEXT
        );

        CREATE TABLE IF NOT EXISTS therapists (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            rating REAL NOT NULL,
            specialties TEXT, -- JSON array of strings
            bio TEXT,
            color TEXT,
            gallery TEXT, -- JSON array of image URLs
            default_schedule TEXT -- JSON object of weekly schedule
        );

        CREATE TABLE IF NOT EXISTS exceptions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            therapist_id TEXT NOT NULL,
            date TEXT NOT NULL,
            active INTEGER NOT NULL, -- 0 for false, 1 for true
            start_time TEXT,
            end_time TEXT,
            FOREIGN KEY (therapist_id) REFERENCES therapists(id) ON DELETE CASCADE,
            UNIQUE(therapist_id, date)
        );

        CREATE TABLE IF NOT EXISTS bookings (
            id TEXT PRIMARY KEY,
            client_name TEXT NOT NULL,
            client_phone TEXT NOT NULL,
            client_email TEXT,
            service_id TEXT NOT NULL,
            therapist_id TEXT NOT NULL,
            date TEXT NOT NULL,
            time TEXT NOT NULL,
            FOREIGN KEY (service_id) REFERENCES services(id),
            FOREIGN KEY (therapist_id) REFERENCES therapists(id) ON DELETE CASCADE
        );
    `);

    // If database already existed, run a migration to scale USD prices to COP values
    if (dbExists) {
        await db.run('UPDATE services SET price = price * 1000 WHERE price < 1000');
    }

    // Check if database needs seeding (if file is new or tables are empty)
    let needsSeeding = !dbExists;
    if (dbExists) {
        try {
            const countRes = await db.get("SELECT COUNT(*) as count FROM services");
            if (!countRes || countRes.count === 0) {
                needsSeeding = true;
            }
        } catch (e) {
            needsSeeding = true;
        }
    }

    if (needsSeeding) {
        console.log("Database empty or not found. Seeding database...");

        // Seed Settings
        await db.run("INSERT INTO settings (key, value) VALUES ('pre_buffer', '15')");
        await db.run("INSERT INTO settings (key, value) VALUES ('post_buffer', '15')");
        await db.run("INSERT INTO settings (key, value) VALUES ('whatsapp_number', '573246895931')");

        // Seed Services (Prices in COP)
        const services = [
            { id: "s-1", name: "Ritual Relajación Profunda", duration: 60, price: 90000, desc: "Masaje de cuerpo completo con óleos aromáticos y sutiles toques calientes.", category: "Relax" },
            { id: "s-2", name: "Masaje Tejido Profundo (Deep Tissue)", duration: 80, price: 120000, desc: "Diseñado para liberar tensiones crónicas mediante presión focalizada.", category: "Terapéutico" },
            { id: "s-3", name: "Sanación con Piedras Volcánicas", duration: 90, price: 140000, desc: "Armonización de chakras con piedras de basalto calientes y terapia manual.", category: "Premium" },
            { id: "s-4", name: "Reflexología Podal Celestial", duration: 45, price: 75000, desc: "Presión estimulante en puntos reflejos para reactivar el balance corporal.", category: "Focalizado" }
        ];

        for (const s of services) {
            await db.run(
                'INSERT INTO services (id, name, duration, price, desc, category) VALUES (?, ?, ?, ?, ?, ?)',
                [s.id, s.name, s.duration, s.price, s.desc, s.category]
            );
        }

        // Seed Therapists
        const therapists = [
            {
                id: "t-1",
                name: "Valentina Gómez",
                rating: 4.9,
                specialties: ["Relajación Profunda", "Piedras Volcánicas"],
                bio: "Valentina tiene más de 6 años de experiencia en terapias holísticas y aromaterapia de lujo.",
                color: "rose",
                gallery: [
                    "https://images.unsplash.com/photo-1600334129128-685c5582fd35?auto=format&fit=crop&w=1000&q=80",
                    "https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=1000&q=80",
                    "https://images.unsplash.com/photo-1519696869836-746174917a26?auto=format&fit=crop&w=1000&q=80"
                ],
                defaultSchedule: {
                    monday:    { active: true, start: "09:00", end: "18:00" },
                    tuesday:   { active: true, start: "09:00", end: "18:00" },
                    wednesday: { active: true, start: "09:00", end: "18:00" },
                    thursday:  { active: true, start: "09:00", end: "18:00" },
                    friday:    { active: true, start: "09:00", end: "20:00" },
                    saturday:  { active: true, start: "10:00", end: "16:00" },
                    sunday:    { active: false, start: "00:00", end: "00:00" }
                },
                exceptions: {
                    "2026-06-15": { active: false },
                    "2026-06-16": { active: true, start: "14:00", end: "19:00" }
                }
            },
            {
                id: "t-2",
                name: "Sebastián Mendoza",
                rating: 4.8,
                specialties: ["Tejido Profundo", "Reflexología Podal"],
                bio: "Especialista en quiromasaje deportivo y técnicas avanzadas de liberación miofascial.",
                color: "amber",
                gallery: [
                    "https://images.unsplash.com/photo-1515377905703-c4788e51af15?auto=format&fit=crop&w=1000&q=80",
                    "https://images.unsplash.com/photo-1519696869836-746174917a26?auto=format&fit=crop&w=1000&q=80",
                    "https://images.unsplash.com/photo-1600334129128-685c5582fd35?auto=format&fit=crop&w=1000&q=80"
                ],
                defaultSchedule: {
                    monday:    { active: true, start: "09:00", end: "18:00" },
                    tuesday:   { active: true, start: "09:00", end: "18:00" },
                    wednesday: { active: true, start: "09:00", end: "18:00" },
                    thursday:  { active: true, start: "09:00", end: "18:00" },
                    friday:    { active: true, start: "09:00", end: "18:00" },
                    saturday:  { active: true, start: "09:00", end: "15:00" },
                    sunday:    { active: false, start: "00:00", end: "00:00" }
                },
                exceptions: {}
            },
            {
                id: "t-3",
                name: "Elena Rostova",
                rating: 5.0,
                specialties: ["Ritual Relajación Profunda", "Sanación con Piedras", "Tejido Profundo"],
                bio: "Terapeuta internacional formada en Tailandia e Indonesia. Trae el arte del confort oriental a Eden.",
                color: "emerald",
                gallery: [
                    "https://images.unsplash.com/photo-1531849626546-8619dfa45025?auto=format&fit=crop&w=1000&q=80",
                    "https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=1000&q=80",
                    "https://images.unsplash.com/photo-1515377905703-c4788e51af15?auto=format&fit=crop&w=1000&q=80"
                ],
                defaultSchedule: {
                    monday:    { active: false, start: "00:00", end: "00:00" },
                    tuesday:   { active: true, start: "10:00", end: "20:00" },
                    wednesday: { active: true, start: "10:00", end: "20:00" },
                    thursday:  { active: true, start: "10:00", end: "20:00" },
                    friday:    { active: true, start: "10:00", end: "20:00" },
                    saturday:  { active: true, start: "10:00", end: "18:00" },
                    sunday:    { active: true, start: "11:00", end: "16:00" }
                },
                exceptions: {}
            }
        ];

        for (const t of therapists) {
            await db.run(
                'INSERT INTO therapists (id, name, rating, specialties, bio, color, gallery, default_schedule) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                [
                    t.id,
                    t.name,
                    t.rating,
                    JSON.stringify(t.specialties),
                    t.bio,
                    t.color,
                    JSON.stringify(t.gallery),
                    JSON.stringify(t.defaultSchedule)
                ]
            );

            // Insert exceptions if any
            for (const [date, exc] of Object.entries(t.exceptions)) {
                await db.run(
                    'INSERT INTO exceptions (therapist_id, date, active, start_time, end_time) VALUES (?, ?, ?, ?, ?)',
                    [t.id, date, exc.active ? 1 : 0, exc.start || null, exc.end || null]
                );
            }
        }

        // Seed Bookings
        const bookings = [
            {
                id: "b-101",
                clientName: "Carolina Herrera",
                clientPhone: "+57 301 2234 567",
                clientEmail: "caro.herrera@email.com",
                serviceId: "s-1",
                therapistId: "t-1",
                date: "2026-06-12",
                time: "10:00"
            },
            {
                id: "b-102",
                clientName: "Alejandro Sanz",
                clientPhone: "+57 312 9988 776",
                clientEmail: "alejo.sanz@email.com",
                serviceId: "s-2",
                therapistId: "t-2",
                date: "2026-06-12",
                time: "14:00"
            }
        ];

        for (const b of bookings) {
            await db.run(
                'INSERT INTO bookings (id, client_name, client_phone, client_email, service_id, therapist_id, date, time) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                [b.id, b.clientName, b.clientPhone, b.clientEmail, b.serviceId, b.therapistId, b.date, b.time]
            );
        }
        console.log("Database initialized and seeded successfully.");
    } else {
        console.log("Database file found. Skipping seeding process to preserve existing data modifications.");
    }

    return db;
}
