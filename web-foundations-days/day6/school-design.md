# School Database Design

## Table Explanations

- **`students`**: Stores the core information about each student. It uses an auto-incrementing `id` as the primary key. The `email` column is marked `UNIQUE` to ensure no two students share the same email address, and `name` is `NOT NULL` because an unidentified student record is useless.
- **`courses`**: Stores the catalogue of available courses. It has a primary key `id`, a required `title`, and a `credits` column with a default value of 3. 
- **`enrolments`**: This is a join table that represents the relationship between a student and a course. It contains foreign keys pointing to both `students` and `courses`. It also holds the `grade` for that specific enrolment. The combination of `student_id` and `course_id` is marked `UNIQUE` to prevent the same student from enrolling in the same course twice, fulfilling the database rule.

## Relationships

- **One-to-Many**: 
  - A single student can have many enrolments (1:N).
  - A single course can have many enrolments (1:N).
- **Many-to-Many**: 
  - Because a student takes many courses, and a course is taken by many students, the relationship between `students` and `courses` is many-to-many (M:N).
- **Why a join table is needed**: Relational databases cannot directly link a many-to-many relationship. If we put a `course_id` inside the `students` table, a student could only take one course. If we put a `student_id` inside the `courses` table, a course could only have one student. The `enrolments` join table solves this by creating a record for every unique pairing of a student and a course, while also providing a logical place to store attributes that belong to that pairing — like the `grade`.

## Index Recommendation

**Recommended Index**: `CREATE INDEX idx_enrolments_student_id ON enrolments(student_id);`

**Reason**: Without an index, querying all the courses a specific student is enrolled in (Query 1) would require a full table scan of the `enrolments` table. Because `student_id` is a foreign key and is used heavily in JOINs and WHERE clauses, indexing it dramatically speeds up these lookups. While SQLite automatically indexes Primary Keys and UNIQUE constraints (like the composite `student_id, course_id`), adding a dedicated index on just `student_id` optimizes single-column lookups, which are very common (e.g., "show me this student's dashboard").

## SQL vs NoSQL

I would choose **SQL** (a relational database) for this system. The data is highly structured and strictly relational — students have a defined schema, courses have a defined schema, and enrolments act as a clear transactional link between them. Critically, the business logic requires strong consistency and relational integrity: we must prevent duplicate enrolments (handled elegantly via a `UNIQUE` constraint), and we cannot have an enrolment that references a student or course that doesn't exist (handled via `FOREIGN KEY` constraints). A NoSQL database would make these integrity checks much harder to enforce at the database level, requiring complex application-level validation. Furthermore, reporting tasks like "number of students per course" require aggregations and JOINs, which are native, highly optimized operations in SQL.