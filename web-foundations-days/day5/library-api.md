# Library API --- Books Resource

A REST API for managing books in a library. All endpoints use JSON for
request and response bodies.

**Base path:** `/api`

## Books resource

A book object looks like this:

``` json
{
  "id": 1,
  "title": "The Pragmatic Programmer",
  "author": "Andrew Hunt",
  "isbn": "978-0201616224",
  "publishedYear": 1999
}
```

## Endpoints

### List all books

-   **Method:** `GET`
-   **Path:** `/api/books`
-   **Description:** Returns an array of all books in the library.
-   **Request body:** None
-   **Success:** `200 OK`

### List books by author

-   **Method:** `GET`
-   **Path:** `/api/books?author=Andrew%20Hunt`
-   **Description:** Returns only the books written by the given author.
-   **Request body:** None
-   **Success:** `200 OK`

### Get one book

-   **Method:** `GET`
-   **Path:** `/api/books/:id`
-   **Description:** Returns a single book identified by its numeric ID.
-   **Request body:** None
-   **Success:** `200 OK`

### Create a book

-   **Method:** `POST`
-   **Path:** `/api/books`
-   **Description:** Adds a new book to the library.

**Request body:**

``` json
{
  "title": "Clean Code",
  "author": "Robert C. Martin",
  "isbn": "978-0132350884",
  "publishedYear": 2008
}
```

-   **Success:** `201 Created`

### Update a book (full replacement)

-   **Method:** `PUT`
-   **Path:** `/api/books/:id`
-   **Description:** Replaces an existing book's fields with the
    provided values.

**Request body:**

``` json
{
  "title": "Clean Code (2nd ed.)",
  "author": "Robert C. Martin",
  "isbn": "978-0132350884",
  "publishedYear": 2008
}
```

-   **Success:** `200 OK`

### Delete a book

-   **Method:** `DELETE`
-   **Path:** `/api/books/:id`
-   **Description:** Removes the book from the library.
-   **Request body:** None
-   **Success:** `204 No Content`

## Error responses

All errors return a JSON body with a `message` field.

### `400 Bad Request`

Happens when the request is malformed or fails validation---for example,
a `POST /api/books` with a missing `title`, or a `publishedYear` that
isn't a number.

**Example body:**

``` json
{
  "message": "Field 'title' is required."
}
```

### `404 Not Found`

Happens when the requested resource doesn't exist---for example,
`GET /api/books/9999` when no book has ID `9999`, or
`DELETE /api/books/42` after that book has already been removed.

**Example body:**

``` json
{
  "message": "Book 9999 not found."
}
```
