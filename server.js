import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { initDb, getDatabaseConnection } from './database.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Serve static frontend files from 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Initialize database before starting server
let db;
try {
    db = await initDb();
} catch (err) {
    console.error("Database initialization failed:", err);
    process.exit(1);
}

// ================= API ENDPOINTS =================

// 0. SETTINGS
app.get('/api/settings', async (req, res) => {
    try {
        const rows = await db.all('SELECT * FROM settings');
        const settings = {};
        rows.forEach(r => {
            settings[r.key] = r.value;
        });
        res.json(settings);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/settings', async (req, res) => {
    try {
        const settings = req.body;
        for (const [key, val] of Object.entries(settings)) {
            await db.run(
                'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
                [key, String(val)]
            );
        }
        res.json({ message: "Settings updated successfully" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 1. SERVICES
app.get('/api/services', async (req, res) => {
    try {
        const services = await db.all('SELECT * FROM services');
        res.json(services);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Create or Update Service
app.post('/api/services', async (req, res) => {
    try {
        const { id, name, duration, price, desc, category } = req.body;
        
        if (!name || duration === undefined || price === undefined || !category) {
            return res.status(400).json({ error: "Missing required service fields" });
        }

        if (id) {
            // Update
            const result = await db.run(
                `UPDATE services 
                 SET name = ?, duration = ?, price = ?, desc = ?, category = ?
                 WHERE id = ?`,
                [name, duration, price, desc || null, category, id]
            );
            if (result.changes === 0) {
                return res.status(404).json({ error: "Service not found" });
            }
            res.json({ message: "Service updated successfully", id });
        } else {
            // Create
            const newId = `s-${Math.floor(Math.random() * 1000) + 10}`;
            await db.run(
                `INSERT INTO services (id, name, duration, price, desc, category)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [newId, name, duration, price, desc || null, category]
            );
            res.status(201).json({ message: "Service created successfully", id: newId });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete Service
app.delete('/api/services/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await db.run('DELETE FROM services WHERE id = ?', [id]);
        if (result.changes === 0) {
            return res.status(404).json({ error: "Service not found" });
        }
        res.json({ message: "Service deleted successfully" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 2. THERAPISTS
app.get('/api/therapists', async (req, res) => {
    try {
        const therapists = await db.all('SELECT * FROM therapists');
        const exceptions = await db.all('SELECT * FROM exceptions');

        // Group exceptions by therapist_id
        const exceptionsByTherapist = {};
        exceptions.forEach(exc => {
            if (!exceptionsByTherapist[exc.therapist_id]) {
                exceptionsByTherapist[exc.therapist_id] = {};
            }
            exceptionsByTherapist[exc.therapist_id][exc.date] = {
                active: exc.active === 1,
                start: exc.start_time || undefined,
                end: exc.end_time || undefined
            };
        });

        // Format and parse JSON columns
        const formattedTherapists = therapists.map(t => {
            return {
                id: t.id,
                name: t.name,
                rating: t.rating,
                specialties: t.specialties ? JSON.parse(t.specialties) : [],
                bio: t.bio,
                color: t.color,
                gallery: t.gallery ? JSON.parse(t.gallery) : [],
                defaultSchedule: t.default_schedule ? JSON.parse(t.default_schedule) : {},
                exceptions: exceptionsByTherapist[t.id] || {}
            };
        });

        res.json(formattedTherapists);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Create or Update Therapist
app.post('/api/therapists', async (req, res) => {
    try {
        const { id, name, rating, specialties, bio, color, gallery, defaultSchedule } = req.body;
        
        if (!name || rating === undefined || !specialties || !bio || !defaultSchedule) {
            return res.status(400).json({ error: "Missing required therapist fields" });
        }

        const specsJson = JSON.stringify(specialties);
        const galleryJson = JSON.stringify(gallery || []);
        const scheduleJson = JSON.stringify(defaultSchedule);

        if (id) {
            // Update
            const result = await db.run(
                `UPDATE therapists 
                 SET name = ?, rating = ?, specialties = ?, bio = ?, color = ?, gallery = ?, default_schedule = ?
                 WHERE id = ?`,
                [name, rating, specsJson, bio, color, galleryJson, scheduleJson, id]
            );
            if (result.changes === 0) {
                return res.status(404).json({ error: "Therapist not found" });
            }
            res.json({ message: "Therapist updated successfully", id });
        } else {
            // Create
            const newId = `t-${Math.floor(Math.random() * 1000) + 10}`;
            await db.run(
                `INSERT INTO therapists (id, name, rating, specialties, bio, color, gallery, default_schedule)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [newId, name, rating, specsJson, bio, color, galleryJson, scheduleJson]
            );
            res.status(201).json({ message: "Therapist created successfully", id: newId });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete Therapist
app.delete('/api/therapists/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await db.run('DELETE FROM therapists WHERE id = ?', [id]);
        if (result.changes === 0) {
            return res.status(404).json({ error: "Therapist not found" });
        }
        res.json({ message: "Therapist deleted successfully" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 3. BOOKINGS
app.get('/api/bookings', async (req, res) => {
    try {
        const bookings = await db.all('SELECT * FROM bookings');
        const formatted = bookings.map(b => ({
            id: b.id,
            clientName: b.client_name,
            clientPhone: b.client_phone,
            clientEmail: b.client_email,
            serviceId: b.service_id,
            therapistId: b.therapist_id,
            date: b.date,
            time: b.time
        }));
        res.json(formatted);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Create Booking
app.post('/api/bookings', async (req, res) => {
    try {
        const { id, clientName, clientPhone, clientEmail, serviceId, therapistId, date, time } = req.body;
        
        if (!id || !clientName || !clientPhone || !serviceId || !therapistId || !date || !time) {
            return res.status(400).json({ error: "Missing required booking fields" });
        }

        await db.run(
            `INSERT INTO bookings (id, client_name, client_phone, client_email, service_id, therapist_id, date, time)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [id, clientName, clientPhone, clientEmail || null, serviceId, therapistId, date, time]
        );
        res.status(201).json({ message: "Booking created successfully", id });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete Booking
app.delete('/api/bookings/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await db.run('DELETE FROM bookings WHERE id = ?', [id]);
        if (result.changes === 0) {
            return res.status(404).json({ error: "Booking not found" });
        }
        res.json({ message: "Booking cancelled successfully" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 4. EXCEPTIONS
app.post('/api/exceptions', async (req, res) => {
    try {
        const { therapistId, date, active, start, end } = req.body;
        
        if (!therapistId || !date || active === undefined) {
            return res.status(400).json({ error: "Missing required exception fields" });
        }

        const isActive = active ? 1 : 0;
        await db.run(
            `INSERT INTO exceptions (therapist_id, date, active, start_time, end_time)
             VALUES (?, ?, ?, ?, ?)
             ON CONFLICT(therapist_id, date) DO UPDATE SET
             active = excluded.active,
             start_time = excluded.start_time,
             end_time = excluded.end_time`,
            [therapistId, date, isActive, start || null, end || null]
        );
        res.json({ message: "Exception saved successfully" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete Exception
app.delete('/api/exceptions/:therapistId/:date', async (req, res) => {
    try {
        const { therapistId, date } = req.params;
        const result = await db.run(
            'DELETE FROM exceptions WHERE therapist_id = ? AND date = ?',
            [therapistId, date]
        );
        if (result.changes === 0) {
            return res.status(404).json({ error: "Exception not found" });
        }
        res.json({ message: "Exception deleted successfully" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Start Server
app.listen(PORT, () => {
    console.log(`Eden Spa server running at http://localhost:${PORT}`);
});
