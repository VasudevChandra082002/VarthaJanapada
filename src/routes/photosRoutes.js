
const express = require("express");
const multer = require("multer");
const { uploadToAzure } = require("../config/azureService");
const photosController = require("../controller/photosController");
const authenticateJWT = require("../middleware/authenticateRole");
const allowedRoles = require("../middleware/allowedRole");

const router = express.Router();
const upload = multer(); // no storage needed — just parses form-data fields

router.post("/upload", upload.single("file"), uploadToAzure);

router.post(
  "/createphotos",
  authenticateJWT,
  allowedRoles(["admin", "moderator"]),
  photosController.createPhotos
);

router.get("/getAllPhotos", photosController.getAllPhotos);
router.get("/:id", photosController.getPhotosById);
router.delete("/deletePhotos/:id",authenticateJWT, allowedRoles(['admin']), photosController.deletePhotosById);
router.patch("/approvePhotos/:id", authenticateJWT, allowedRoles(['admin']), photosController.approvePhotos);
module.exports = router;