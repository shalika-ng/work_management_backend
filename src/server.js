require("dotenv").config();

const app = require("./app");
const pool = require("./config/database");

const PORT = process.env.PORT || 4000;

app.listen(PORT, async () => {
  console.log(`Server running on http://localhost:${PORT}`);

  try {
    await pool.query("SELECT NOW()");
    console.log("Database connected successfully");
  } catch (error) {
    console.error("Database connection failed!");
    console.error(error.message);
  }
});