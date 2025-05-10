# 🎬 VideoDownCut

<div align="center">
  <img src="https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript">
  <img src="https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white" alt="Node.js">
  <img src="https://img.shields.io/badge/Express-000000?style=for-the-badge&logo=express&logoColor=white" alt="Express.js">
  <img src="https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white" alt="PostgreSQL">
  <img src="https://img.shields.io/badge/Docker-2CA5E0?style=for-the-badge&logo=docker&logoColor=white" alt="Docker">
</div>

<div align="center">
  <h3>🚀 Download, cut and convert videos with ease</h3>
</div>

## 📋 Overview

VideoDownCut is a robust API for downloading, cutting, and processing videos. Using modern technologies such as Node.js, Express, and FFmpeg, this application makes web video manipulation easy with a simple and powerful interface.

### ✨ Features

- **Video download** from various platforms
- **Precise cutting** of videos with timestamps
- **Audio extraction** (MP3 format)
- **Streaming** of media content
- **Format conversion** (MP4, WebM, MKV)
- **RESTful API** with Swagger documentation
- **Validation** of inputs and error handling
- **Containerization** with Docker for easy deployment

## 🛠️ Technologies Used

- **Backend**: Node.js, Express, TypeScript
- **Database**: PostgreSQL, TypeORM
- **Video processing**: FFmpeg, yt-dlp
- **Documentation**: Swagger UI
- **Logging**: Winston
- **Containerization**: Docker, Docker Compose

## ⚙️ Installation

### Prerequisites

- Node.js (v14+)
- FFmpeg
- yt-dlp
- PostgreSQL (or Docker)

### Using Docker (Recommended)

1. Clone the repository:
   ```bash
   git clone https://github.com/TheMegafuji/VideoDownCut-api.git
   cd VideoDownCut-api
   ```

2. Configure the environment variables:
   ```bash
   cp .env.example .env
   # Edit the .env file with your configuration
   ```

3. Run with Docker Compose:
   ```bash
   docker-compose up
   ```

4. Access the API at: `http://localhost:3001`
   
5. Access Swagger documentation: `http://localhost:3001/api-docs`

### Manual Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/TheMegafuji/VideoDownCut-api.git
   cd VideoDownCut-api
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure the environment variables:
   ```bash
   cp .env.example .env
   # Edit the .env file with your configuration
   ```

4. Compile TypeScript:
   ```bash
   npm run build
   ```

5. Run the server:
   ```bash
   npm start
   ```

## 🚀 Usage

### API Routes

#### Video Download
```http
POST /api/videos/download
Content-Type: application/json

{
  "url": "https://www.youtube.com/watch?v=VIDEO_ID"
}
```

#### Video Cutting
```http
POST /api/videos/cut
Content-Type: application/json

{
  "videoId": "VIDEO_ID",
  "cutOptions": {
    "startTime": "00:01:30",
    "endTime": "00:02:45",
    "format": "mp4"
  }
}
```

#### Audio Extraction (MP3)
```http
GET /api/videos/mp3/VIDEO_ID?startTime=00:01:30&endTime=00:02:45
```

#### Video Streaming
```http
GET /api/videos/stream/VIDEO_ID
```

#### Processed Video Download
```http
GET /api/videos/download/FILENAME
```

## 🧩 Usage Examples

### Complete Flow Example

1. **Download a video**:
   ```javascript
   fetch('http://localhost:3001/api/videos/download', {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({ url: 'https://www.youtube.com/watch?v=VIDEO_ID' })
   })
   .then(response => response.json())
   .then(data => {
     const videoId = data.data.videoId;
     // Use the videoId for the next operations
   });
   ```

2. **Cut the video**:
   ```javascript
   fetch('http://localhost:3001/api/videos/cut', {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({
       videoId: 'VIDEO_ID',
       cutOptions: {
         startTime: '00:01:30',
         endTime: '00:02:45',
         format: 'mp4'
       }
     })
   })
   .then(response => response.json())
   .then(data => {
     const downloadUrl = data.data.downloadUrl;
     // Use the downloadUrl to download the cut video
   });
   ```

## 🤝 Contribution

Contributions are welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for more details.

## 📃 License

This project is licensed under the ISC license - see the [LICENSE](LICENSE) file for more details.

## 🔗 Useful Links

- [FFmpeg Documentation](https://ffmpeg.org/documentation.html)
- [yt-dlp Documentation](https://github.com/yt-dlp/yt-dlp#readme)
- [Prettier Guide](PRETTIER.md)
