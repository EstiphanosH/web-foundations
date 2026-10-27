-- ============================================================
-- Day 6: School Database Schema
-- Database: SQLite
-- ============================================================

-- Enable foreign key enforcement in SQLite (required per connection)
PRAGMA foreign_keys = ON;

-- ============================================================
-- 1. TABLE CREATION
-- ============================================================

-- Drop tables if they exist (useful for re-running the script)
DROP TABLE IF EXISTS enrolments;
DROP TABLE IF EXISTS courses;
DROP TABLE IF EXISTS students;

-- Students table
CREATE TABLE students (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE
);

-- Courses table
CREATE TABLE courses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    credits INTEGER NOT NULL DEFAULT 3
);

-- Enrolments table (Join table between students and courses)
CREATE TABLE enrolments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER NOT NULL,
    course_id INTEGER NOT NULL,
    grade TEXT CHECK (grade IN ('A', 'B', 'C', 'D', 'F', NULL)), -- Optional check constraint for valid grades
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
    UNIQUE (student_id, course_id) -- Rule: Prevent duplicate enrolment
);

-- Index to speed up looking up a student's enrolments
CREATE INDEX idx_enrolments_student_id ON enrolments(student_id);

-- ============================================================
-- 2. DATA INSERTION
-- ============================================================

BEGIN TRANSACTION;

-- Insert 3 students
INSERT INTO students (name, email) VALUES 
    ('Alice Smith', 'alice@example.com'),
    ('Bob Jones', 'bob@example.com'),
    ('Charlie Brown', 'charlie@example.com');

-- Insert 3 courses
INSERT INTO courses (title, credits) VALUES 
    ('Introduction to SQL', 3),
    ('Web Development', 4),
    ('Database Design', 3);

-- Insert 5 enrolments
INSERT INTO enrolments (student_id, course_id, grade) VALUES 
    (1, 1, 'A'), -- Alice in SQL
    (1, 2, 'B'), -- Alice in Web Dev
    (2, 1, 'C'), -- Bob in SQL
    (3, 3, NULL),-- Charlie in DB Design (no grade yet)
    (2, 3, 'B'); -- Bob in DB Design

COMMIT;

-- ============================================================
-- 3. QUERIES
-- ============================================================

-- Query 1: All courses for one student (by name)
-- Shows the courses Alice Smith is enrolled in.
SELECT c.title AS course_title
FROM courses c
JOIN enrolments e ON c.id = e.course_id
JOIN students s ON s.id = e.student_id
WHERE s.name = 'Alice Smith';

-- Query 2: All students on one course
-- Shows students enrolled in 'Introduction to SQL'.
SELECT s.name AS student_name
FROM students s
JOIN enrolments e ON s.id = e.student_id
JOIN courses c ON c.id = e.course_id
WHERE c.title = 'Introduction to SQL';

-- Query 3: Number of students per course
-- Uses LEFT JOIN to ensure courses with 0 students still appear.
SELECT c.title AS course_title, COUNT(e.student_id) AS enrolled_students
FROM courses c
LEFT JOIN enrolments e ON c.id = e.course_id
GROUP BY c.id, c.title;

-- Query 4: Students who have no enrolments
-- Uses LEFT JOIN and checks for NULL in the enrolments table.
SELECT s.name AS student_name
FROM students s
LEFT JOIN enrolments e ON s.id = e.student_id
WHERE e.id IS NULL;

-- Query 5: Update one enrolment's grade
-- Updates Bob's grade in 'Introduction to SQL' from C to A.
UPDATE enrolments
SET grade = 'A'
WHERE student_id = (SELECT id FROM students WHERE name = 'Bob Jones')
  AND course_id = (SELECT id FROM courses WHERE title = 'Introduction to SQL');

-- Verification query to show the update worked
SELECT s.name, c.title, e.grade
FROM enrolments e
JOIN students s ON s.id = e.student_id
JOIN courses c ON c.id = e.course_id
WHERE s.name = 'Bob Jones' AND c.title = 'Introduction to SQL';