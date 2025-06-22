import React, { useState, useEffect } from "react";
import axios from "axios";
import "./App.css";

// Replace with your actual API Gateway URL
const API_BASE_URL =
  "https://ptax69wzp2.execute-api.eu-west-1.amazonaws.com/prod";

function App() {
  const [images, setImages] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [modalImage, setModalImage] = useState(null);

  // Load images on component mount
  useEffect(() => {
    loadImages();
  }, []);

  const loadImages = async () => {
    setIsLoading(true);
    console.log("🔍 Loading images from gallery...");

    try {
      const response = await axios.get(`${API_BASE_URL}/images`);
      console.log("📸 Gallery response:", response.data);

      // FIXED: Parse the response data properly - API Gateway wraps the response
      let responseData;
      if (response.data.body) {
        // API Gateway response format with statusCode, headers, body
        responseData = JSON.parse(response.data.body);
      } else if (typeof response.data === 'string') {
        // Direct string response
        responseData = JSON.parse(response.data);
      } else {
        // Direct object response
        responseData = response.data;
      }

      console.log("📋 Parsed response data:", responseData);

      const imageList = responseData.images || [];
      console.log(`🖼️ Found ${imageList.length} images:`, imageList);

      setImages(imageList);

      if (imageList.length === 0) {
        console.log("📭 No images found in gallery");
      }
    } catch (error) {
      console.error("❌ Error loading images:", error);
      console.error("🚨 Gallery error details:", {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
      });

      setImages([]);
      showNotification("Error loading images", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const showNotification = (message, type = "success") => {
    const notification = document.getElementById("notification");
    if (notification) {
      notification.innerText = message;
      notification.className = `notification ${type} show`;

      setTimeout(() => {
        notification.classList.remove("show");
      }, 3000);
    }
  };

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    processSelectedFile(file);
  };

  const processSelectedFile = (file) => {
    console.log("File selected:", file);

    if (!file) {
      return;
    }

    // Validate file type
    const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      console.log("Invalid file type:", file.type);
      showNotification(
        "Please select a valid image file (JPEG, PNG, GIF, or WebP)",
        "error"
      );
      return;
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      showNotification("File size must be less than 10MB", "error");
      return;
    }

    console.log("Valid file:", file.name, file.type, file.size);
    setSelectedFile(file);

    // Create preview URL
    const fileReader = new FileReader();
    fileReader.onload = () => {
      setPreviewUrl(fileReader.result);
    };
    fileReader.readAsDataURL(file);
  };

  const uploadImage = async () => {
    if (!selectedFile) {
      showNotification("Please select a file first", "error");
      return;
    }

    if (!selectedFile.name || !selectedFile.type) {
      showNotification("Invalid file selected. Please try again.", "error");
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    try {
      console.log("🚀 Starting upload process...");
      console.log("📁 File details:", {
        name: selectedFile.name,
        type: selectedFile.type,
        size: selectedFile.size,
      });

      // Step 1: Get presigned URL
      console.log("📡 Requesting presigned URL...");
      setUploadProgress(20);

      const response = await axios.post(`${API_BASE_URL}/upload`, {
        filename: selectedFile.name,
        contentType: selectedFile.type,
      });

      console.log("✅ Presigned URL response:", response.data);
      
      // FIXED: Parse the response data properly - API Gateway wraps the response
      let responseData;
      if (response.data.body) {
        // API Gateway response format with statusCode, headers, body
        responseData = JSON.parse(response.data.body);
      } else if (typeof response.data === 'string') {
        // Direct string response
        responseData = JSON.parse(response.data);
      } else {
        // Direct object response
        responseData = response.data;
      }
      
      console.log("📋 Parsed response data:", responseData);
      
      const { uploadUrl, filename } = responseData;

      if (!uploadUrl) {
        console.error("❌ No uploadUrl in response:", responseData);
        throw new Error("No upload URL received from server");
      }

      // Step 2: Upload file to S3
      console.log("☁️ Uploading to S3...");
      console.log("🔗 Upload URL:", uploadUrl);
      setUploadProgress(50);

      const uploadResponse = await axios.put(uploadUrl, selectedFile, {
        headers: {
          "Content-Type": selectedFile.type,
        },
        onUploadProgress: (progressEvent) => {
          const progress =
            50 + Math.round((progressEvent.loaded * 40) / progressEvent.total);
          setUploadProgress(progress);
          console.log(`📊 Upload progress: ${progress}%`);
        },
      });

      console.log("🎉 S3 upload completed!");
      console.log("📋 Upload response details:", {
        status: uploadResponse.status,
        statusText: uploadResponse.statusText,
        headers: uploadResponse.headers,
      });

      if (uploadResponse.status === 200) {
        setUploadProgress(100);

        // Reset file selection
        setSelectedFile(null);
        setPreviewUrl(null);

        showNotification(
          `Image "${filename}" uploaded successfully!`,
          "success"
        );

        console.log("🔄 Refreshing gallery in 2 seconds...");
        setTimeout(() => {
          console.log("🖼️ Loading images...");
          loadImages();
        }, 2000);
      } else {
        throw new Error(`Upload failed with status: ${uploadResponse.status}`);
      }
    } catch (error) {
      console.error("❌ Upload error:", error);

      // Enhanced error logging
      if (error.response) {
        console.error("🚨 Error response details:", {
          status: error.response.status,
          statusText: error.response.statusText,
          data: error.response.data,
          headers: error.response.headers,
        });
      }

      let errorMessage = "Error uploading image";
      if (error.response?.status === 403) {
        errorMessage = "Upload failed: Permission denied or URL expired";
        console.error(
          "🔒 Permission error - check S3 bucket policy and Lambda permissions"
        );
      } else if (error.response?.status === 400) {
        errorMessage = "Upload failed: Invalid file or request";
        console.error(
          "📝 Bad request - check file format and request structure"
        );
      } else if (error.response?.status === 404) {
        errorMessage = "Upload failed: S3 bucket not found";
        console.error("🪣 S3 bucket not found - check bucket name");
      } else if (error.response?.data?.message) {
        errorMessage += ": " + error.response.data.message;
      } else if (error.message) {
        errorMessage += ": " + error.message;
      }

      showNotification(errorMessage, "error");
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      console.log("File dropped:", file);
      processSelectedFile(file);
    }
  };

  const formatFileName = (fileName) => {
    const parts = fileName.split("/");
    const name = parts[parts.length - 1];
    return name.length > 20 ? name.substring(0, 17) + "..." : name;
  };

  const handleImageError = (e) => {
    if (e && e.target) {
      e.target.src =
        "https://via.placeholder.com/300x200?text=Image+Not+Available";
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const openImageModal = (image) => {
    setModalImage(image);
    document.body.style.overflow = 'hidden';
  };

  const closeImageModal = () => {
    setModalImage(null);
    document.body.style.overflow = 'auto';
  };

  return (
    <div className="app">
      <div id="notification" className="notification"></div>
      
      {/* Image Modal */}
      {modalImage && (
        <div className="modal-overlay" onClick={closeImageModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={closeImageModal}>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
            <div className="modal-image-container">
              <img 
                src={modalImage.url} 
                alt={modalImage.key} 
                onError={handleImageError}
              />
            </div>
            <div className="modal-info">
              <h3>{formatFileName(modalImage.key)}</h3>
            </div>
          </div>
        </div>
      )}

      <header className="header">
        <div className="header-content">
          <h1>Photo Gallery</h1>
        </div>
      </header>
      
      <main className="main-content">
        <section className="upload-section">
          <div 
            className="dropzone"
            onDragOver={handleDragOver}
            onDrop={handleDrop}
          >
            {previewUrl ? (
              <div className="preview-container">
                <img src={previewUrl} alt="Preview" className="file-preview" />
                <div className="preview-info">
                  <p>{selectedFile.name}</p>
                  <p className="file-size">{formatFileSize(selectedFile.size)}</p>
                </div>
                <button 
                  className="remove-btn"
                  onClick={() => {
                    setSelectedFile(null);
                    setPreviewUrl(null);
                  }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                  Remove
                </button>
              </div>
            ) : (
              <>
                <div className="upload-icon">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                </div>
                <h3>Upload your photos</h3>
                <p>Drag & drop an image here or click to browse</p>
                <input
                  type="file"
                  id="file-input"
                  accept="image/jpeg,image/png,image/gif,image/webp"
                  onChange={handleFileSelect}
                  disabled={uploading}
                />
                <label htmlFor="file-input" className="browse-btn">
                  Browse Files
                </label>
              </>
            )}
          </div>
          
          {selectedFile && (
            <div className="upload-actions">
              <button 
                className={`upload-btn ${uploading ? 'uploading' : ''}`}
                onClick={uploadImage}
                disabled={!selectedFile || uploading}
              >
                {uploading ? (
                  <>
                    <div className="upload-progress-container">
                      <div 
                        className="upload-progress-bar" 
                        style={{ width: `${uploadProgress}%` }}
                      ></div>
                    </div>
                    <span>{uploadProgress}%</span>
                  </>
                ) : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="17 8 12 3 7 8" />
                      <line x1="12" y1="3" x2="12" y2="15" />
                    </svg>
                    Upload Image
                  </>
                )}
              </button>
            </div>
          )}
        </section>

        <section className="gallery-section">
          <div className="gallery-header">
            <h2>Gallery</h2>
            <span className="image-count">{images.length} photos</span>
            <button 
              className="refresh-btn" 
              onClick={loadImages} 
              disabled={isLoading}
              title="Refresh gallery"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M23 4v6h-6M1 20v-6h6" />
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
              </svg>
            </button>
          </div>
          
          {isLoading ? (
            <div className="loading-container">
              <div className="loader"></div>
              <p>Loading your photos...</p>
            </div>
          ) : (
            <div className="image-grid">
              {images.length > 0 ? (
                images.map((image) => (
                  <div 
                    key={image.key} 
                    className="image-card"
                    onClick={() => openImageModal(image)}
                  >
                    <div className="image-wrapper">
                      <img 
                        src={image.url} 
                        alt={formatFileName(image.key)}
                        loading="lazy"
                        onError={handleImageError}
                      />
                      <div className="image-overlay">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <circle cx="11" cy="11" r="8"></circle>
                          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                          <line x1="11" y1="8" x2="11" y2="14"></line>
                          <line x1="8" y1="11" x2="14" y2="11"></line>
                        </svg>
                      </div>
                    </div>
                    <div className="image-info">
                      <p title={image.key}>{formatFileName(image.key)}</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="empty-gallery">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <polyline points="21 15 16 10 5 21" />
                  </svg>
                  <p>No photos yet. Upload your first image!</p>
                </div>
              )}
            </div>
          )}
        </section>
      </main>
      
      <footer className="footer">
        <p>Modern Photo Gallery</p>
      </footer>
    </div>
  );
}

export default App;