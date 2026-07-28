const { webFrame } = require('electron');

// Hỗ trợ Phóng to / Thu nhỏ ứng dụng bằng Ctrl + Con lăn chuột (Ctrl + MouseWheel)
window.addEventListener('wheel', (event) => {
  if (event.ctrlKey) {
    event.preventDefault();
    const currentZoom = webFrame.getZoomLevel();
    // deltaY < 0 là lăn bánh xe lên (Zoom In / Phóng to)
    // deltaY > 0 là lăn bánh xe xuống (Zoom Out / Thu nhỏ)
    if (event.deltaY < 0) {
      if (currentZoom < 5) {
        webFrame.setZoomLevel(currentZoom + 0.3);
      }
    } else if (event.deltaY > 0) {
      if (currentZoom > -3) {
        webFrame.setZoomLevel(currentZoom - 0.3);
      }
    }
  }
}, { passive: false });
