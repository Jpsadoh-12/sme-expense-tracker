import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { pool, initDb } from "./db.js";

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

if (!process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET is required");
}

/* =========================
   CORS
========================= */

const allowedOrigins = process.env.CLIENT_URL
  ? process.env.CLIENT_URL
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean)
  : [];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.length === 0) {
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error("Not allowed by CORS"));
    },
  })
);

app.use(express.json());

/* =========================
   AUTHENTICATION
========================= */

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers.authorization;

  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.split(" ")[1]
    : null;

  if (!token) {
    return res.status(401).json({
      message: "Authentication required",
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    req.user = decoded;

    next();
  } catch {
    return res.status(401).json({
      message: "Invalid or expired token",
    });
  }
};

/* =========================
   HELPERS
========================= */

const mapTransaction = (row) => ({
  id: String(row.id),
  type: row.type,
  description: row.description,
  category: row.category,
  amount: Number(row.amount),
  date:
    row.transaction_date instanceof Date
      ? row.transaction_date.toISOString().slice(0, 10)
      : String(row.transaction_date).slice(0, 10),
});

/* =========================
   AUTH - REGISTER
========================= */

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

    const user = result.rows[0];

    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "7d",
      }
    );

    res.status(201).json({
      message: "Account created successfully",
      token,
      user,
    });
  } catch (error) {
    console.error("Registration error:", error);

    res.status(500).json({
      message: "Could not create account",
    });
  }
});

/* =========================
   AUTH - LOGIN
========================= */

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
      `SELECT id, name, email, password_hash
       FROM users
       WHERE email = $1`,
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
      {
        expiresIn: "7d",
      }
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
/* =========================
   AUTH - CURRENT USER
========================= */

app.get("/api/auth/me", authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, email
       FROM users
       WHERE id = $1`,
      [req.user.userId]
    );

    if (!result.rows.length) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    res.json({
      user: result.rows[0],
    });
  } catch (error) {
    console.error("Current user error:", error);

    res.status(500).json({
      message: "Could not load user",
    });
  }
});
app.delete("/api/auth/account", authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      "DELETE FROM users WHERE id = $1",
      [req.user.userId]
    );

    if (!result.rowCount) {
      return res.status(404).json({
        message: "Account not found",
      });
    }

    res.status(204).send();
  } catch (error) {
    console.error("Account deletion error:", error);

    res.status(500).json({
      message: "Could not delete account",
    });
  }
});
/* =========================
   HEALTH
========================= */

app.get("/api/health", async (_req, res) => {
  try {
    await pool.query("SELECT 1");

    res.json({
      ok: true,
      message: "SME Expense Tracker API is running",
    });
  } catch (error) {
    console.error("Health check error:", error);

    res.status(500).json({
      ok: false,
      message: "Database unavailable",
    });
  }
});

/* =========================
   CATEGORIES
========================= */

app.get("/api/categories", async (_req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT id, name FROM categories ORDER BY name"
    );

    res.json(rows);
  } catch (error) {
    console.error("Categories error:", error);

    res.status(500).json({
      message: "Could not load categories",
    });
  }
});

/* =========================
   GET TRANSACTIONS
========================= */

app.get(
  "/api/transactions",
  authenticateToken,
  async (req, res) => {
    try {
      const { type, search } = req.query;

      const values = [req.user.userId];

      const where = ["t.user_id = $1"];

      if (type === "income" || type === "expense") {
        values.push(type);

        where.push(`t.type = $${values.length}`);
      }

      if (search) {
        values.push(`%${search}%`);

        where.push(
          `(t.description ILIKE $${values.length}
            OR c.name ILIKE $${values.length})`
        );
      }

      const sql = `
        SELECT
          t.id,
          t.type,
          t.description,
          c.name AS category,
          t.amount,
          t.transaction_date
        FROM transactions t
        JOIN categories c
          ON c.id = t.category_id
        WHERE ${where.join(" AND ")}
        ORDER BY
          t.transaction_date DESC,
          t.id DESC
      `;

      const { rows } = await pool.query(sql, values);

      res.json(rows.map(mapTransaction));
    } catch (error) {
      console.error("Load transactions error:", error);

      res.status(500).json({
        message: "Could not load transactions",
      });
    }
  }
);

/* =========================
   CREATE TRANSACTION
========================= */

app.post(
  "/api/transactions",
  authenticateToken,
  async (req, res) => {
    try {
      const {
        type,
        description,
        category,
        amount,
        date,
      } = req.body;

      if (
        !["income", "expense"].includes(type) ||
        !description ||
        !category ||
        !Number(amount) ||
        Number(amount) <= 0 ||
        !date
      ) {
        return res.status(400).json({
          message: "Invalid transaction data",
        });
      }

      const result = await pool.query(
        `INSERT INTO transactions
          (
            user_id,
            type,
            description,
            category_id,
            amount,
            transaction_date
          )
         SELECT
            $1,
            $2,
            $3,
            id,
            $4,
            $5
         FROM categories
         WHERE name = $6
         RETURNING
            id,
            type,
            description,
            amount,
            transaction_date,
            (
              SELECT name
              FROM categories
              WHERE id = transactions.category_id
            ) AS category`,
        [
          req.user.userId,
          type,
          description.trim(),
          Number(amount),
          date,
          category,
        ]
      );

      if (!result.rows.length) {
        return res.status(400).json({
          message: "Category not found",
        });
      }

      res.status(201).json(
        mapTransaction(result.rows[0])
      );
    } catch (error) {
      console.error(
        "Create transaction error:",
        error
      );

      res.status(500).json({
        message:
          error instanceof Error
            ? error.message
            : "Could not create transaction",
      });
    }
  }
);

/* =========================
   UPDATE TRANSACTION
========================= */

app.put(
  "/api/transactions/:id",
  authenticateToken,
  async (req, res) => {
    try {
      const {
        type,
        description,
        category,
        amount,
        date,
      } = req.body;

      if (
        !["income", "expense"].includes(type) ||
        !description ||
        !category ||
        !Number(amount) ||
        Number(amount) <= 0 ||
        !date
      ) {
        return res.status(400).json({
          message: "Invalid transaction data",
        });
      }

      const result = await pool.query(
        `UPDATE transactions t
         SET
           type = $1,
           description = $2,
           category_id = c.id,
           amount = $4,
           transaction_date = $5
         FROM categories c
         WHERE
           t.id = $6
           AND t.user_id = $7
           AND c.name = $3
         RETURNING
           t.id,
           t.type,
           t.description,
           t.amount,
           t.transaction_date,
           c.name AS category`,
        [
          type,
          description.trim(),
          category,
          Number(amount),
          date,
          req.params.id,
          req.user.userId,
        ]
      );

      if (!result.rows.length) {
        return res.status(404).json({
          message:
            "Transaction not found or category not found",
        });
      }

      res.json(mapTransaction(result.rows[0]));
    } catch (error) {
      console.error(
        "Update transaction error:",
        error
      );

      res.status(500).json({
        message: "Could not update transaction",
      });
    }
  }
);

/* =========================
   DELETE TRANSACTION
========================= */

app.delete(
  "/api/transactions/:id",
  authenticateToken,
  async (req, res) => {
    try {
      const result = await pool.query(
        `DELETE FROM transactions
         WHERE id = $1
           AND user_id = $2`,
        [
          req.params.id,
          req.user.userId,
        ]
      );

      if (!result.rowCount) {
        return res.status(404).json({
          message: "Transaction not found",
        });
      }

      res.status(204).send();
    } catch (error) {
      console.error(
        "Delete transaction error:",
        error
      );

      res.status(500).json({
        message: "Could not delete transaction",
      });
    }
  }
);

/* =========================
   SUMMARY
========================= */

app.get(
  "/api/summary",
  authenticateToken,
  async (req, res) => {
    try {
      const totals = await pool.query(
        `
        SELECT
          COALESCE(
            SUM(
              CASE
                WHEN type = 'income'
                THEN amount
                ELSE 0
              END
            ),
            0
          ) AS income,

          COALESCE(
            SUM(
              CASE
                WHEN type = 'expense'
                THEN amount
                ELSE 0
              END
            ),
            0
          ) AS expenses,

          COUNT(*)::int AS transactions

        FROM transactions

        WHERE user_id = $1
        `,
        [req.user.userId]
      );

      const categories = await pool.query(
        `
        SELECT
          c.name AS category,
          COALESCE(SUM(t.amount), 0) AS total

        FROM transactions t

        JOIN categories c
          ON c.id = t.category_id

        WHERE
          t.user_id = $1
          AND t.type = 'expense'
          AND date_trunc(
            'month',
            t.transaction_date
          ) = date_trunc(
            'month',
            CURRENT_DATE
          )

        GROUP BY c.name

        ORDER BY total DESC
        `,
        [req.user.userId]
      );

      const income =
        Number(totals.rows[0].income);

      const expenses =
        Number(totals.rows[0].expenses);

      res.json({
        income,
        expenses,
        balance: income - expenses,
        transactions:
          totals.rows[0].transactions,

        categoryTotals:
          categories.rows.map((x) => ({
            category: x.category,
            total: Number(x.total),
          })),
      });
    } catch (error) {
      console.error(
        "Summary error:",
        error
      );

      res.status(500).json({
        message: "Could not load summary",
      });
    }
  }
);

/* =========================
   START SERVER
========================= */

initDb()
  .then(() => {
    app.listen(port, () => {
      console.log(
        `API running on port ${port}`
      );
    });
  })
  .catch((error) => {
    console.error(
      "Database initialization failed:",
      error.message
    );

    process.exit(1);
  });
