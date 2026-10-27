# SnapShare — System Scaling Plan

## 1. Assumptions

To size the system correctly, I establish the following assumptions based on the starting facts:

- **Registered Users:** 10,000,000
- **Daily Active Users (DAU):** 10% of registered users = **1,000,000 users**
- **Uploads:** Each active user uploads exactly 1 photo per day
- **Feed Views:** Each active user views 50 feed pages per day. (I assume one feed page load requests a batch of ~10 photos, but for bandwidth and rate-limiting purposes, I count page requests.)
- **Media Sizes:** Average photo = 2 MB; average thumbnail = 50 KB
- **Traffic Distribution:** Traffic is not uniform; I assume a peak traffic period where usage is 5× the average

## 2. Capacity Estimates

### 2.1 Uploads per second (average)

- Total photos per day = 1,000,000 DAU × 1 upload = **1,000,000 photos/day**
- Seconds per day = 24 × 60 × 60 = **86,400 seconds**
- Average uploads/sec = 1,000,000 / 86,400 ≈ **11.57 uploads/sec**

### 2.2 Feed views per second (average and peak)

- Total feed views per day = 1,000,000 DAU × 50 views = **50,000,000 views/day**
- Average feed views/sec = 50,000,000 / 86,400 ≈ **578.7 views/sec**
- Peak feed views/sec = 578.7 × 5 = **2,893.5 views/sec**

### 2.3 Storage per year

- **Original Photos:** 1,000,000 photos/day × 2 MB = 2,000,000 MB/day ≈ **2 TB/day**
- **Thumbnails:** 1,000,000 photos/day × 50 KB = 50,000,000 KB/day ≈ **47.68 GB/day**
- **Total per day:** ~**2.047 TB/day**
- **Total per year:** 2.047 TB × 365 ≈ **747 TB/year**

## 3. Read-Heavy vs. Write-Heavy

This system is heavily **read-heavy**.

With an average of ~11.5 writes per second and ~579 reads per second, the read-to-write ratio is roughly **50:1**, and it reaches about **250:1 at peak**.

### Design implications

- **Database Scaling:** I need read replicas to handle the massive volume of feed queries.
- **Caching:** A caching layer (such as Redis) is critical to absorb feed requests so the database is not hit 2,893 times per second during peak traffic.
- **CDN:** Serving images directly from app servers or the database would rapidly overwhelm the infrastructure; a content delivery network is mandatory for media delivery.

## 4. Why photos must not live in the database

Storing photos as BLOBs (Binary Large Objects) inside a relational database is a Ill-known anti-pattern for high-scale apps. Databases are optimized for fast lookups of small, structured data and for maintaining ACID transactions. Storing 2 MB files inside them causes:

- **Database bloat:** Backups and replication become slow and expensive.
- **Memory exhaustion:** Database caches are designed to hold rows in RAM, and large binaries flush that cache, slowing down normal queries.
- **Connection exhaustion:** Streaming large files keeps database connections open longer and starves other requests.

**Where they should go instead:**
Photos should be stored in **object storage** (for example, AWS S3 or Google Cloud Storage), which is designed for massive scale, durability, and low-cost storage. The database should store only the metadata (user ID, caption, timestamp) and the **URL/key** referring to the object in storage.

## 5. Architecture Diagram (Text)

```text
[ Users / Mobile Clients ]
           │
           ▼
[ Load Balancer (ALB) ]
           │
           ▼
[ App Servers (Stateless Ib/API) ]
     │           │             │
     │           │             └──────────────────────┐
     │           │                                    ▼
     │           │                             [ Cache (Redis) ]
     │           │                             - Feed caching
     │           ▼                                    │
     │    [ Message Queue ]                           │
     │    - Upload events, thumbnail jobs             │
     │           │                                    │
     │           ▼                                    ▼
     │    [ Worker Servers ]                   [ Primary Database ]
     │    - Generate thumbnails                - Writes (Users, Posts)
     │           │                                    │
     │           │                                    ▼
     │           │                             [ Read Replica DB ]
     │           │                             - Feed reads, profile views
     │           ▼
     │    [ Object Storage (S3) ] ──────────> [ CDN (Edge Network) ]
     └──────> - Stores original photos        - Serves thumbnails/photos
              - Stores thumbnails                 to users globally
```

## 6. Component Explanations

Each component solves a distinct problem in the system:

- **CDN (Content Delivery Network):** Caches and serves photos and thumbnails from edge servers close to the user, reducing latency and loIring bandwidth costs on the origin servers.
- **Load Balancer:** Distributes incoming HTTP requests across multiple app servers, avoiding single points of failure and preventing traffic overload.
- **App Servers:** Run the stateless Ib/API layer, handling business logic, authentication, and routing while scaling horizontally.
- **Cache (Redis):** Stores precomputed feed arrays and frequently accessed metadata in memory, reducing database load from repeated feed reads.
- **Primary Database:** Handles all write operations, such as new users and photo metadata, and acts as the source of truth for data integrity.
- **Read Replica Database:** Mirrors the primary database and serves heavy read traffic, preventing read queries from bottlenecking write performance.
- **Object Storage (S3):** Stores original photo files and thumbnails, providing cheap, durable, and scalable media storage.
- **Message Queue:** Buffers upload events and thumbnail-generation tasks, preventing dropped jobs during traffic spikes and decoupling services.
- **Worker Servers:** Pull tasks from the queue, generate thumbnails, and process media asynchronously without blocking the user request.

## 7. Step-by-Step Upload Flow

1. **Request Upload URL:** The user selects a photo, and the client app sends a request to the app server to initiate an upload with metadata such as file size and type.
2. **Generate Pre-Signed URL:** The app server requests a pre-signed upload URL from object storage, allowing the client to upload directly without sending the file through the app servers.
3. **Direct Upload to Object Storage:** The client uploads the 2 MB image directly to the object storage bucket using the pre-signed URL.
4. **Notify Server:** Once the upload succeeds, the client sends a confirmation to the app server, including the generated storage key.
5. **Save Metadata:** The app server saves the photo’s metadata (user ID, caption, storage key, timestamp) to the primary database.
6. **Enqueue Thumbnail Job:** The app server places a message in the message queue indicating that a thumbnail needs to be created.
7. **Worker Processes Image:** A worker server picks up the message, downloads the original image from object storage, resizes it to a 50 KB thumbnail, and uploads the thumbnail back to object storage.
8. **Update Thumbnail URL:** The worker updates the database record with the new thumbnail storage key so the feed can load quickly.

## 8. Trade-offs

### Trade-off 1: Pre-signed URLs vs. proxying uploads

I chose pre-signed URLs so clients upload directly to S3 and the app servers do not carry the bandwidth cost. The trade-off is increased complexity in security and upload flow: I must generate temporary tokens correctly and validate file types, since the client can upload directly to storage without server-side interception.

### Trade-off 2: Eventual consistency on the feed (read replicas)

I chose to route most feed reads to read replicas to protect the primary database. The trade-off is replication lag (eventual consistency): if a user uploads a photo and immediately refreshes their feed, they may not see their own post yet because the read replica has not synced the write from the primary database. This is generally acceptable for a social app, but it requires thoughtful UI design such as optimistic updates.

