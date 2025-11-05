const Magazine = require("../models/magazineModel2"); // Capital 'M' for model
const { search } = require("../routes/newsRoutes");
const { Translate } = require("@google-cloud/translate").v2;
const MagazineVersion = require("../models/magazineVersionModel2");
 

const createMagazine = async (req, res) => {
  try {
    const { title, description } = req.body;

    // Basic validation (optional but recommended)
    if (!title) {
      return res.status(400).json({ success: false, message: "Title is required" });
    }
    if (!description) {
      return res.status(400).json({ success: false, message: "Description is required" });
    }

    const newMagazine = new Magazine({
      title,
      description,
      publishedDate: req.body.publishedDate,
      publishedMonth: req.body.publishedMonth,
      publishedYear: req.body.publishedYear,
      magazineThumbnail: req.body.magazineThumbnail,
      magazinePdf: req.body.magazinePdf,
      editionNumber: req.body.editionNumber,
      last_updated: new Date(),
      createdBy: req.user.id,
      status: req.user.role === "admin" ? "approved" : "pending",
    });

    const savedMagazine = await newMagazine.save();
    res.status(201).json({ success: true, data: savedMagazine });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};



const getMagazines = async (req, res) => {
  try {
    const { publishedYear, publishedMonth, homepage, editionNumber } =
      req.query; // Extract query parameters

    // Build the filter object based on provided query parameters
    const filter = {};

    // Add conditions to the filter object if they exist in the query parameters
    if (publishedYear) {
      filter.publishedYear = publishedYear;
    }

    if (publishedMonth) {
      filter.publishedMonth = publishedMonth;
    }

    if (editionNumber !== undefined && editionNumber !== "0") {
      if (editionNumber.trim() !== "") {
        filter.editionNumber = editionNumber.trim();
      }
    }

    // Check if the homepage query parameter is passed
    const limit = homepage ? 10 : null; // Limit to 10 items if homepage is true

    // Find magazines based on the filter object and apply limit if necessary
    const magazines = await Magazine.find(filter)
      .sort({ createdTime: -1 }) // Sort by latest first
      .limit(limit) // Apply limit if homepage is true
      .populate("createdBy");

    res.status(200).json({ success: true, data: magazines });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

const getMagazineById = async (req, res) => {
  try {
    const magazine = await Magazine.findById(req.params.id); // Use 'Magazine'
    if (!magazine) {
      // Check if magazine exists
      return res
        .status(404)
        .json({ success: false, message: "Magazine not found" });
    }
    res.status(200).json({ success: true, data: magazine });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};


const deleteMagazineVersion2 = async (req, res) => {
  try {
    const { id, versionNumber } = req.params;
    const deleted = await MagazineVersion.findOneAndDelete({ magazineId: id, versionNumber });

    if (!deleted) {
      return res.status(404).json({ success: false, message: "Version not found" });
    }

    // Renumber all remaining versions sequentially
    const versions = await MagazineVersion.find({ magazineId: id }).sort({ versionNumber: 1 });
    for (let i = 0; i < versions.length; i++) {
      versions[i].versionNumber = i + 1;
      await versions[i].save();
    }

    res.status(200).json({ success: true, message: "Version deleted and renumbered successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
const searchMagazine = async (req, res) => {
  try {
    const { query } = req.query; // Use req.query for search parameters

    if (!query) {
      return res.status(400).json({
        success: false,
        message: "Search query is required",
      });
    }

    const magazineList = await Magazine.find({
      title: { $regex: query, $options: "i" }, // Case-insensitive search
    }).sort({ createdTime: -1 }); // Sort by createdTime (if needed)

    if (magazineList.length === 0) {
      return res.status(404).json({
        success: false,
        data: [],
        message: "No magazines found matching the search criteria",
      });
    }

    res.status(200).json({ success: true, data: magazineList });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getTotalMagazines = async (req, res) => {
  try {
    const totalMagazines = await Magazine.countDocuments();
    res.status(200).json({ success: true, data: totalMagazines });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};


const updateMagazine = async (req, res) => {
  try {
    const { id } = req.params;
    const updatedData = req.body;

    const magazine = await Magazine.findById(id);
    if (!magazine) {
      return res.status(404).json({ success: false, message: "Magazine not found" });
    }

    // Save version snapshot BEFORE applying updates
    const versionCount = await MagazineVersion.countDocuments({ magazineId: id });
    await MagazineVersion.create({
      magazineId: id,
      versionNumber: versionCount + 1,
      updatedBy: req.user.id,
      snapshot: magazine.toObject(),
    });

    // Apply updates (no translation involved)
    if (updatedData.title !== undefined) magazine.title = updatedData.title;
    if (updatedData.description !== undefined) magazine.description = updatedData.description;
    if (updatedData.magazineThumbnail !== undefined) magazine.magazineThumbnail = updatedData.magazineThumbnail;
    if (updatedData.magazinePdf !== undefined) magazine.magazinePdf = updatedData.magazinePdf;
    if (updatedData.editionNumber !== undefined) magazine.editionNumber = updatedData.editionNumber;

    // Published month/year
    if (updatedData.publishedMonth !== undefined) magazine.publishedMonth = updatedData.publishedMonth;
    if (updatedData.publishedYear !== undefined) magazine.publishedYear = updatedData.publishedYear;

    // Status & timestamps
    magazine.last_updated = new Date();
    if (req.user.role === "moderator") {
      magazine.status = "pending";
    }

    const updatedMagazine = await magazine.save();

    res.status(200).json({
      success: true,
      data: updatedMagazine,
      message: "Magazine updated successfully",
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};


const getMagazineHistory = async (req, res) => {
  try {
    const { id } = req.params;
    const history = await MagazineVersion.find({ magazineId: id })
      .populate("updatedBy", "displayName email")
      .sort({ versionNumber: -1 });

    if (!history.length) {
      return res.status(404).json({ success: false, message: "No version history found" });
    }

    res.status(200).json({ success: true, data: history });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const approvemagazine = async (req, res) => {
  try {
    const { id } = req.params;
    const updatedData = { status: "approved" };
    const updatedMagazine = await Magazine.findByIdAndUpdate(id, updatedData, {
      new: true,
    });
    if (!updatedMagazine) {
      return res.status(404).json({ success: false, message: "Magazine not found" });
    }
    res.status(200).json({ success: true, data: updatedMagazine });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};


const revertMagazineToVersion = async (req, res) => {
  try {
    const { id, versionNumber } = req.params;

    const currentVersionNumber = parseInt(versionNumber);
    const targetVersionNumber = currentVersionNumber - 1;

    const targetVersion = await MagazineVersion.findOne({
      magazineId: id,
      versionNumber: targetVersionNumber,
    });

    if (!targetVersion) {
      return res.status(404).json({ success: false, message: "Target version not found." });
    }

    await Magazine.updateOne({ _id: id }, targetVersion.snapshot);

    await MagazineVersion.deleteOne({
      magazineId: id,
      versionNumber: currentVersionNumber,
    });

    res.status(200).json({ success: true, message: "Reverted and cleaned up successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};


const deleteMagazine = async (req, res) => {
  try {
    const deletedMagazine = await Magazine.findByIdAndDelete(req.params.id); // Use 'Magazine'
    if (!deletedMagazine) {
      return res
        .status(404)
        .json({ success: false, message: "Magazine not found" });
    }
    res
      .status(200)
      .json({ success: true, message: "Magazine deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};



const getMagazinesByYear = async (req, res) => {
  try {
    const { year } = req.params;

    // ✅ Validate year format (must be 4 digits)
    if (!/^\d{4}$/.test(year)) {
      return res.status(400).json({
        success: false,
        message: "Invalid year format. Use YYYY (e.g., 2025)",
      });
    }

    // ✅ Find all magazines for the given year
    const magazines = await Magazine.find({ publishedYear: year })
      .populate("createdBy", "displayName email role")
      .lean();

    // ✅ Return 200 with empty array if none found
    if (!magazines.length) {
      return res.status(200).json({
        success: true,
        message: `No magazines found for year ${year}`,
        count: 0,
        data: [],
      });
    }

    // ✅ Month order mapping (case-insensitive)
    const monthOrder = {
      january: 1,
      february: 2,
      march: 3,
      april: 4,
      may: 5,
      june: 6,
      july: 7,
      august: 8,
      september: 9,
      october: 10,
      november: 11,
      december: 12,
    };

    // ✅ Sort by month (Jan → Dec), and within same month by createdTime DESC
    const sortedMagazines = magazines.sort((a, b) => {
      const monthA = monthOrder[a.publishedMonth?.toLowerCase()] || 13;
      const monthB = monthOrder[b.publishedMonth?.toLowerCase()] || 13;

      // Sort by month ascending
      if (monthA !== monthB) return monthA - monthB;

      // Within same month, latest createdTime first
      return new Date(b.createdTime) - new Date(a.createdTime);
    });

    // ✅ Return response
    res.status(200).json({
      success: true,
      count: sortedMagazines.length,
      data: sortedMagazines,
    });
  } catch (error) {
    console.error("Error fetching magazines by year:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};


const User = require("../models/userModel");
const addMarchOfKarnatakaToPlaylist = async (req, res) => {
  try {
    const { userId, magazineId } = req.body;
    console.log("Adding to March of Karnataka playlist:", { userId, magazineId });

    if (!userId || !magazineId) {
      return res
        .status(400)
        .json({ success: false, message: "userId and magazineId are required" });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    const magazine = await Magazine.findById(magazineId);
    if (!magazine)
      return res.status(404).json({ success: false, message: "Magazine not found" });

    // Ensure array exists
    if (!user.playlist) user.playlist = {};
    if (!user.playlist.marchofkarnatakaplaylist)
      user.playlist.marchofkarnatakaplaylist = [];

    // Prevent duplicates
    const alreadyExists = user.playlist.marchofkarnatakaplaylist.some(
      (item) => item.magazineId && item.magazineId.toString() === magazineId
    );
    if (alreadyExists)
      return res
        .status(400)
        .json({ success: false, message: "Magazine already in playlist" });

    // Add
    user.playlist.marchofkarnatakaplaylist.push({ magazineId });
    await user.save();

    res.status(200).json({
      success: true,
      message: "Magazine added to March of Karnataka playlist successfully",
      playlist: user.playlist.marchofkarnatakaplaylist,
    });
  } catch (error) {
    console.error("Error adding to March of Karnataka playlist:", error);
    res.status(500).json({ success: false, message: "Server error", error });
  }
};

// ➖ Remove magazine from playlist
const removeMarchOfKarnatakaFromPlaylist = async (req, res) => {
  try {
    const { userId, magazineId } = req.body;

    // Validate required fields
    if (!userId || !magazineId) {
      return res
        .status(400)
        .json({ success: false, message: "userId and magazineId are required" });
    }

    // Find user
    const user = await User.findById(userId);
    if (!user)
      return res.status(404).json({ success: false, message: "User not found" });

    // Ensure playlist structure exists
    if (!user.playlist) user.playlist = {};
    if (!user.playlist.marchofkarnatakaplaylist)
      user.playlist.marchofkarnatakaplaylist = [];

    // Filter out the magazineId safely
    user.playlist.marchofkarnatakaplaylist =
      user.playlist.marchofkarnatakaplaylist.filter(
        (item) => item.magazineId && item.magazineId.toString() !== magazineId
      );

    // Save user
    await user.save();

    res.status(200).json({
      success: true,
      message: "Magazine removed from March of Karnataka playlist successfully",
      playlist: user.playlist.marchofkarnatakaplaylist,
    });
  } catch (error) {
    console.error("Error removing from March of Karnataka playlist:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message || error,
    });
  }
};



// 📄 Get user's March of Karnataka playlist
const getMarchOfKarnatakaPlaylist = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId).populate(
      "playlist.marchofkarnatakaplaylist.magazineId"
    );
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    res.status(200).json({
      success: true,
      playlist: user.playlist.marchofkarnatakaplaylist,
    });
  } catch (error) {
    console.error("Error fetching March of Karnataka playlist:", error);
    res.status(500).json({ success: false, message: "Server error", error });
  }
};


module.exports = {
  addMarchOfKarnatakaToPlaylist,
  removeMarchOfKarnatakaFromPlaylist,
  getMarchOfKarnatakaPlaylist,
  getMagazinesByYear,
  createMagazine,
  getMagazines,
  getMagazineById,
  deleteMagazineVersion2,
  searchMagazine,
  getTotalMagazines,
  updateMagazine,
  approvemagazine,
  getMagazineHistory,
  revertMagazineToVersion,
  deleteMagazine
};
