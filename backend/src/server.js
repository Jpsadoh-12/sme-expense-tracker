import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { pool, initDb } from "./db.js";

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

app.use(cors({ origin: process.env.CLIENT_URL?.split(",") || true }));
app.use(express.json());

const mapTransaction = (row) => ({
  id: String(row.id),
  type: row.type,
  description: row.description,
  category: row.category,
  amount: Number(row.amount),
  date: row.transaction_date.toISOString().slice(0, 10),
});
app.post("/api/auth/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        message: "Name, email and password are required",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        message: "Password must be at least 6 characters",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const existing = await pool.query(
      "SELECT id FROM users WHERE email = $1",
      [normalizedEmail]
    );

    if (existing.rows.length) {
      return res.status(409).json({
        message: "An account with this email already exists",
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const result = await pool.query(
      `INSERT INTO users (name, email, password_hash)
       VALUES ($1, $2, $3)
       RETURNING id, name, email`,
      [name.trim(), normalizedEmail, passwordHash]
    );

    res.status(201).json({
      message: "Account created successfully",
      user: result.rows[0],
    });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({
      message: "Could not create account",
    });
  }
});
app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message: "Email and password are required",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const result = await pool.query(
      "SELECT id, name, email, password_hash FROM users WHERE email = $1",
      [normalizedEmail]
    );

    if (!result.rows.length) {
      return res.status(401).json({
        message: "Invalid email or password",
      });
    }

    const user = result.rows[0];

    const validPassword = await bcrypt.compare(
      password,
      user.password_hash
    );

    if (!validPassword) {
      return res.status(401).json({
        message: "Invalid email or password",
      });
    }

    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
      },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      message: "Login successful",
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({
      message: "Could not log in",
    });
  }
});
app.get("/api/health", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ ok: true, message: "SME Expense Tracker API is running" });
  } catch {
    res.status(500).json({ ok: false, message: "Database unavailable" });
  }
});

app.get("/api/categories", async (_req, res) => {
  try {
    const { rows } = await pool.query("SELECT id, name FROM categories ORDER BY name");
    res.json(rows);
  } catch {
    res.status(500).json({ message: "Could not load categories" });
  }
});

app.get("/api/transactions", async (req, res) => {
  try {
    const { type, search } = req.query;
    const values = [];
    const where = [];

    if (type === "income" || type === "expense") {
      values.push(type);
      where.push(`t.type = $${values.length}`);
    }
    if (search) {
      values.push(`%${search}%`);
      where.push(`(t.description ILIKE $${values.length} OR c.name ILIKE $${values.length})`);
    }

    const sql = `
      SELECT t.id, t.type, t.description, c.name AS category,
             t.amount, t.transaction_date
      FROM transactions t
      JOIN categories c ON c.id = t.category_id
      ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
      ORDER BY t.transaction_date DESC, t.id DESC
    `;

    const { rows } = await pool.query(sql, values);
    res.json(rows.map(mapTransaction));
  } catch {
    res.status(500).json({ message: "Could not load transactions" });
  }
});

app.post("/api/transactions", async (req, res) => {
  try {
    const { type, description, category, amount, date } = req.body;
    if (!["income","expense"].includes(type) || !description || !category || !Number(amount) || Number(amount) <= 0 || !date) {
      return res.status(400).json({ message: "Invalid transaction data" });
    }

    const result = await pool.query(
      `INSERT INTO transactions (type, description, category_id, amount, transaction_date)
       SELECT $1, $2, id, $3, $4 FROM categories WHERE name = $5
       RETURNING id, type, description, amount, transaction_date,
                 (SELECT name FROM categories WHERE id = transactions.category_id) AS category`,
      [type, description.trim(), Number(amount), date, category]
    );

    if (!result.rows.length) return res.status(400).json({ message: "Category not found" });
    res.status(201).json(mapTransaction(result.rows[0]));
  } catch {
    res.status(500).json({ message: "Could not create transaction" });
  }
});

app.put("/api/transactions/:id", async (req, res) => {
  try {
    const { type, description, category, amount, date } = req.body;
    const result = await pool.query(
      `UPDATE transactions
       SET type=$1, description=$2,
           category_id=(SELECT id FROM categories WHERE name=$3),
           amount=$4, transaction_date=$5
       WHERE id=$6
       RETURNING id, type, description, amount, transaction_date,
                 (SELECT name FROM categories WHERE id = transactions.category_id) AS category`,
      [type, description.trim(), category, Number(amount), date, req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ message: "Transaction not found" });
    res.json(mapTransaction(result.rows[0]));
  } catch {
    res.status(500).json({ message: "Could not update transaction" });
  }
});

app.delete("/api/transactions/:id", async (req, res) => {
  try {
    const result = await pool.query("DELETE FROM transactions WHERE id=$1", [req.params.id]);
    if (!result.rowCount) return res.status(404).json({ message: "Transaction not found" });
    res.status(204).send();
  } catch {
    res.status(500).json({ message: "Could not delete transaction" });
  }
});

app.get("/api/summary", async (_req, res) => {
  try {
    const totals = await pool.query(`
      SELECT
        COALESCE(SUM(CASE WHEN type='income' THEN amount ELSE 0 END),0) AS income,
        COALESCE(SUM(CASE WHEN type='expense' THEN amount ELSE 0 END),0) AS expenses,
        COUNT(*)::int AS transactions
      FROM transactions
    `);
    const categories = await pool.query(`
      SELECT c.name AS category, COALESCE(SUM(t.amount),0) AS total
      FROM transactions t
      JOIN categories c ON c.id=t.category_id
      WHERE t.type='expense'
        AND date_trunc('month', t.transaction_date)=date_trunc('month', CURRENT_DATE)
      GROUP BY c.name
      ORDER BY total DESC
    `);
    const income = Number(totals.rows[0].income);
    const expenses = Number(totals.rows[0].expenses);
    res.json({
      income,
      expenses,
      balance: income - expenses,
      transactions: totals.rows[0].transactions,
      categoryTotals: categories.rows.map(x => ({ category: x.category, total: Number(x.total) }))
    });
  } catch {
    res.status(500).json({ message: "Could not load summary" });
  }
});

initDb()
  .then(() => app.listen(port, () => console.log(`API running on port ${port}`)))
  .catch((error) => {
    console.error("Database initialization failed:", error.message);
    process.exit(1);
  });
