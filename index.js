const express = require("express");
const path = require("path");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const cors = require("cors");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const dotenv = require("dotenv");

const app = express();
dotenv.config()
app.use(express.json());
app.use(cors());

let db;
let filePath = path.join(__dirname, "nxt-trendz.db");
const port = process.env.PORT || 3000;

const initializeDBandServer = async () => {
  try {
    db = await open({
      filename: filePath,
      driver: sqlite3.Database,
    });
    app.listen(port, () => {
      console.log(`Server is running at http://localhost:${port}`);
    });
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
    process.exit(1);
  }
};

initializeDBandServer();

// API 0:GEt Useers
app.get("/users/", async (request, response) => {
  const getUsersQuery = `
        SELECT * FROM user;
        `;
  const usersArray = await db.all(getUsersQuery);
  response.send(usersArray);
});
// Delete users
app.delete("/users/delete", async (request, response) => {
  const getUsersQuery = `
        DELETE FROM user;
        `;
  await db.run(getUsersQuery);
  response.send("Users deleted");
});

// API 1: Register User
app.post("/register/", async (request, response) => {
  const { username, password } = request.body;
  const hashedPassword = await bcrypt.hash(password, 10);
  const getUserQuery = `
        SELECT * FROM user WHERE username = '${username}';
        `;
  const dbUser = await db.get(getUserQuery);
  if (dbUser === undefined) {
    if (username !== "" && password !== "") {
      const createUserQuery = `
      INSERT INTO user (username, password)
      VALUES ('${username}', '${hashedPassword}');
      `;
      await db.run(createUserQuery);
      response.send({ message: "User created successfully" });
    } else {
      response.status(400);
      response.send({ message: "Username or password should not be empty" });
    }
  } else {
    response.status(400);
    response.send({ message: "User already exists" });
  }
});

// API 2: Login User
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const getUserQuery = `SELECT * FROM user WHERE username='${username}';`;
  const dbUser = await db.get(getUserQuery);
  if (dbUser === undefined) {
    response.status(401);
    response.send({ message: "Invalid user" });
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched === true) {
      const payload = { username: username };
      const jwtToken = jwt.sign(payload, "MY_SECRET_KEY");
      response.send({ jwtToken });
    } else {
      response.status(401);
      response.send({ message: "Invalid password" });
    }
  }
});

const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "MY_SECRET_KEY", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Jwt Token Not Verified");
      } else {
        request.username = payload.username;
        next();
      }
    });
  }
};

// API 3: Get Products
app.get("/products/", authenticateToken, async (request, response) => {
  const { sort_by, category, title_search, rating } = request.query;
  let sort_by_value = null;
  if (sort_by === "PRICE_HIGH") {
    sort_by_value = "DESC";
  } else {
    sort_by_value = "ASC";
  }

  const getProductsQuery = `
  SELECT * FROM products
  WHERE title LIKE '%${title_search}%' AND
  category LIKE '%${category}%' AND 
  rating > '${rating}'
  ORDER BY price ${sort_by_value}
  ;
  `;
  const productsArray = await db.all(getProductsQuery);
  response.send(productsArray);
});
// Get Products by Id
app.get("/products/:id",authenticateToken,async (request,response)=>{
  const { id } = request.params;
  const getProductQuery = `
  SELECT * FROM products WHERE id = ${id};
  `;
  const product = await db.get(getProductQuery);
  response.send(product);
})

//Update Products
app.put("/products/:id",authenticateToken, async (request,response)=>{
  const { id } = request.params;
  const { availability, description, style, total_reviews } = request.body;
  const updateProductQuery = `
  UPDATE products SET availability = '${availability}', description = '${description}', style = '${style}', total_reviews = ${total_reviews} WHERE id = ${id};
  `;
  await db.run(updateProductQuery);
  response.send("Product updated successfully");
})


// GET similar products

app.get("/similar-products/",authenticateToken, async (request,response)=>{
  const {category} = request.query;
  const getSimilarProductsQuery = `
  SELECT * FROM products WHERE category LIKE '%${category}%' LIMIT 5;
  `;
  const similarProductsArray = await db.all(getSimilarProductsQuery);
  response.send(similarProductsArray);
})
