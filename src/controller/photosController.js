

const Photos = require("../models/photosModel");
const mongoose = require("mongoose");
const User = require("../models/userModel");

const createPhotos = async (req, res) => {
  try {
    const { photoImage,title } = req.body;
    const user = req.user;
    if (!photoImage) {
      return res.status(400).json({
        success: false,
        message: "Photo URL (photoImage) is required.",
      });
    }

  if (!title) {
      return res.status(400).json({
        success: false,
        message: "Title is required.",
      });
    }

    const photos = new Photos({
      title,
      photoImage, // ✅ store the blob URL here
      createdBy: user.id,
      status: req.user.role === "admin" ? "approved" : "pending",
      createdTime: new Date(),
    });

    await photos.save();

    res.status(201).json({
      success: true,
      message: "Photo created successfully",
      data: photos,
    });
  } catch (error) {
    console.error("Error creating photo:", error);
    res.status(500).json({
      success: false,
      message: "Error creating photo",
      error: error.message,
    });
  }
};

module.exports = { createPhotos };


const approvePhotos = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate photo ID
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid photo ID",
      });
    }

    // Find the photo by ID
    const photo = await Photos.findById(id).populate("createdBy", "email name");

    if (!photo) {
      return res.status(404).json({
        success: false,
        message: "Photo not found",
      });
    }

    // Check if photo is already approved
    if (photo.status === "approved") {
      return res.status(400).json({
        success: false,
        message: "Photo is already approved",
      });
    }

    // Update photo status to approved
    photo.status = "approved";
    photo.last_updated = new Date();

    await photo.save();

    res.status(200).json({
      success: true,
      message: "Photo approved successfully",
      data: {
        id: photo._id,
        status: photo.status,
        last_updated: photo.last_updated,
        createdBy: photo.createdBy,
      },
    });
  } catch (error) {
    console.error("Error approving photo:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

const getAllPhotos = async (req, res) => {
  try {
    const photos = await Photos.find().populate(
      "createdBy"
    ); // Specify fields to populate
    res.status(200).json(photos);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const getPhotosById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(404).send("No photos with that id");
    }
    const photos = await Photos.findById(id);
    res.status(200).json(photos);
  } catch (error) {
    res.status(404).json({ message: error.message });
  }
};

const deletePhotosById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(404).send("No photos with that id");
    }
    await Photos.findByIdAndDelete(id);
    res.json({ message: "Photos deleted successfully" });
  } catch (error) {
    res.status(404).json({ message: error.message });
  }
};

module.exports = {
  createPhotos,
  approvePhotos,
  getAllPhotos,
  getPhotosById,
  deletePhotosById,
};
