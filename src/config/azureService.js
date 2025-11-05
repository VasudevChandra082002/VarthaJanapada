
const { BlobServiceClient } = require("@azure/storage-blob");

function getContentType(ext) {
  const t = {
    pdf: "application/pdf",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    mp4: "video/mp4",
    mov: "video/quicktime",
  };
  return t[ext] || "application/octet-stream";
}

function normalizePrefix(raw) {
  if (!raw) return "";
  const clean = String(raw)
    .replace(/^\/+|\/+$/g, "")
    .split("/")
    .filter(Boolean)
    .map(seg => seg.replace(/[^A-Za-z0-9-_]/g, "_"))
    .join("/");
  return clean ? `${clean}/` : "";
}

exports.uploadToAzure = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No file uploaded. Field must be 'file'." });
    }

    const conn = (process.env.AZURE_STORAGE_CONNECTION_STRING || "").trim();
    if (!conn) {
      return res.status(500).json({ success: false, message: "AZURE_STORAGE_CONNECTION_STRING missing" });
    }

    const blobServiceClient = BlobServiceClient.fromConnectionString(conn);
    await blobServiceClient.getAccountInfo(); // connectivity probe

    // container name
    const containerName = String(req.body.containerName || "photos").trim().toLowerCase();
    if (!/^[a-z0-9-]+$/.test(containerName)) {
      return res.status(400).json({ success: false, message: "Invalid containerName. Use lowercase letters, numbers or dashes only." });
    }
    const containerClient = blobServiceClient.getContainerClient(containerName);
    await containerClient.createIfNotExists({ access: "container" });

    // ✅ Use prefix from client (e.g., "2024/January/")
    //    OR build from year/month if you send those too.
      const prefix = normalizePrefix(req.body.prefix);  // e.g. "1900/May/"

  const ext = (req.file.originalname.split(".").pop() || "").toLowerCase();
  const contentType = getContentType(ext);
  const safeName = req.file.originalname.replace(/[^\w.\-()]/g, "_");
  const blobName = `${prefix}${Date.now()}-${safeName}`;

  console.log("UPLOAD DEBUG:", { prefix, blobName }); // should print "1900/May/..."
    // Helpful debug during testing
    console.log("UPLOAD DEBUG =>", { containerName, prefix, blobName });

    const blockBlobClient = containerClient.getBlockBlobClient(blobName);
    await blockBlobClient.uploadData(req.file.buffer, {
      blobHTTPHeaders: { blobContentType: contentType },
    });

    return res.status(200).json({
      success: true,
      message: "File uploaded successfully",
      blobUrl: blockBlobClient.url, // should now contain year/month
      blobName,
      prefix,
      containerName,
      contentType,
    });
  } catch (error) {
    console.error("Azure upload error:", error);
    return res.status(500).json({
      success: false,
      message: "Error uploading file",
      error: error?.message || String(error),
    });
  }
};
