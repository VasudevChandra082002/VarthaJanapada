const Announcement = require("../models/AnnouncementModel");
const { Translate } = require("@google-cloud/translate").v2;


const translateText = async (text, targetLanguage) => {
  try {
    const [translation] = await translate.translate(text, targetLanguage);
    return translation;
  } catch (err) {
    console.error(`Error translating to ${targetLanguage}:`, err);
    return text; // Return the original text if translation fails
  }
};

exports.createAnnouncement = async (req, res) => {
  try {
    const { title, description } = req.body;

    if (!title || !description) {
      return res.status(400).json({
        status: "fail",
        message: "Both title and description are required",
      });
    }

    // Create announcement WITHOUT translations
    const newAnnouncement = await Announcement.create({
      title,         // plain string
      description,   // plain string
      // createdBy: req.user?.id, // uncomment if you track creator
      // status: req.user?.role === "admin" ? "approved" : "pending", // optional
      createdTime: new Date(),
      last_updated: new Date(),
    });

    res.status(201).json({
      status: "success",
      data: { announcement: newAnnouncement },
    });
  } catch (err) {
    res.status(400).json({
      status: "fail",
      message: err.message,
    });
  }
};


exports.getAllAnnouncements = async (req, res) => {
  try {
    const announcements = await Announcement.find().sort({ createdTime: -1 }); // Sort by latest first

    res.status(200).json({
      status: "success",
      results: announcements.length,
      data: {
        announcements,
      },
    });
  } catch (err) {
    res.status(400).json({
      status: "fail",
      message: err.message,
    });
  }
};

// 3. Get a single announcement by ID
exports.getAnnouncementById = async (req, res) => {
  try {
    const { id } = req.params;

    const announcement = await Announcement.findById(id);
    if (!announcement) {
      return res.status(404).json({
        status: "fail",
        message: "Announcement not found.",
      });
    }

    res.status(200).json({
      status: "success",
      data: {
        announcement,
      },
    });
  } catch (err) {
    res.status(400).json({
      status: "fail",
      message: err.message,
    });
  }
};



exports.updateAnnouncement = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description } = req.body;

    const update = {
      last_updated: new Date(),
    };
    if (title !== undefined) update.title = title;
    if (description !== undefined) update.description = description;

    const updatedAnnouncement = await Announcement.findByIdAndUpdate(
      id,
      update,
      { new: true, runValidators: true }
    );

    if (!updatedAnnouncement) {
      return res.status(404).json({
        status: "fail",
        message: "Announcement not found.",
      });
    }

    res.status(200).json({
      status: "success",
      data: { announcement: updatedAnnouncement },
    });
  } catch (err) {
    res.status(400).json({ status: "fail", message: err.message });
  }
};


// 5. Delete an announcement
exports.deleteAnnouncement = async (req, res) => {
  try {
    const { id } = req.params;

    const announcement = await Announcement.findByIdAndDelete(id);
    if (!announcement) {
      return res.status(404).json({
        status: "fail",
        message: "Announcement not found.",
      });
    }

    res.status(204).json({
      status: "success",
      data: null,
    });
  } catch (err) {
    res.status(400).json({
      status: "fail",
      message: err.message,
    });
  }
};
