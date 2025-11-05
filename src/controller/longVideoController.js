const Videos = require("../models/longVideoModel");
const Comment = require("../models/commentsModel");
const mongoose = require("mongoose");
const LongVideoVersion = require("../models/longVideoVersionModel");

const { Translate } = require("@google-cloud/translate").v2;

function normalizeMagazineType(input) {
  if (input == null) return undefined;
  const s = String(input).trim().toLowerCase();
  if (s === "magazine" || s === "mag") return "magazine";
  if (s === "magazine2" || s === "mag2") return "magazine2";
  return "invalid";
}


function normalizeNewsType(input) {
  if (input == null) return undefined;
  const s = String(input).trim().toLowerCase();

  // Accept a few common aliases; store canonical value
  if (["statenews", "state", "state_news"].includes(s)) return "statenews";
  if (["districtnews", "district", "district_news"].includes(s)) return "districtnews";
  if (["specialnews", "special", "special_news"].includes(s)) return "specialnews";

  return "invalid";
}



exports.uploadVideo = async (req, res) => {
  try {
    const {
      title,
      description,
      thumbnail,
      video_url,
      category,
      magazineType,
      newsType,
    } = req.body;

    // Validate required fields
    if (!title || !description || !thumbnail || !video_url || !category) {
      return res.status(400).json({
        success: false,
        message:
          "Please provide all required fields: title, description, videoThumbnail, videoUrl, category",
      });
    }

    // Validate magazineType
    const normalizedMagazine = normalizeMagazineType(magazineType);
    if (normalizedMagazine === "invalid") {
      return res.status(400).json({
        success: false,
        message: "Invalid magazineType. Use 'magazine' or 'magazine2'.",
      });
    }

    // Validate newsType (optional)
    const normalizedNews = normalizeNewsType(newsType);
    if (normalizedNews === "invalid") {
      return res.status(400).json({
        success: false,
        message:
          "Invalid newsType. Use 'statenews', 'districtnews', or 'specialnews'.",
      });
    }

    // Create a new video (NO translations)
    const newVideo = new Videos({
      title,
      description,
      thumbnail,
      video_url,
      category,
      videoDuration: req.body.videoDuration, // optional
      last_updated: new Date(),
      createdBy: req.user.id,
      status: req.user.role === "admin" ? "approved" : "pending",
      magazineType: normalizedMagazine,
      newsType: normalizedNews,
    });

    const savedVideo = await newVideo.save();

    res.status(201).json({ success: true, data: savedVideo });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getAllVideos = async (req, res) => {
  try {
    const videos = await Videos.find()
    .populate({
      path: "Comments", // Populate the Comments array
      populate: {
        // Populate the 'user' field within each comment
        path: "user", // Assuming your Comment model has a 'user' field referencing the User model
        select: "displayName profileImage", // Select which fields from the user you want to include (important for performance)
         
      },
     
    })
     .populate("createdBy")
     ///populate category name 
     .populate({
      path: "category",
      select: "name", // Select only the 'name' field from the Category model
    })
    res.status(200).json({ success: true, data: videos });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getVideoId = async (req, res) => {
  try {
    const video = await Videos.findById(req.params.id)
      .populate({
        path: "Comments",
        populate: {
          path: "user",
          select: "displayName profileImage", // Select the fields you need
        },
      })
      .populate("createdBy");
    res.status(200).json({ success: true, data: video });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteVideo = async (req, res) => {
  try {
    const video = await Videos.findByIdAndDelete(req.params.id);
    if (!video) {
      return res
        .status(404)
        .json({ success: false, message: "No video found" });
    }
    res.status(200).json({ success: true, data: video });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
exports.addCommentToVideo = async (req, res) => {
  try {
    const { userId, videoId, text } = req.body;

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(videoId)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid videoId" });
    }

   
    const video = await Videos.findById(videoId);
   
    if (!video) {
      return res
        .status(404)
        .json({ success: false, message: "Video not found" });
    }

    // Create a new comment
    const newComment = new Comment({
      user: userId,
      video: videoId,
      comment: text,
    });

    // Save the comment
    const savedComment = await newComment.save();
   
    video.Comments.push(savedComment._id);
    await video.save();

    res.status(201).json({ success: true, data: savedComment });
  } catch (error) {
    console.error("Error adding comment:", error); // Log the error for debugging
    res.status(500).json({ success: false, message: error.message });
  }
};
exports.deleteCommentByUserIdAndCommentId = async (req, res) => {
  try {
    const { userId, commentId } = req.body; // Extract userId and commentId

    // Validate ObjectIds
    if (
      !mongoose.Types.ObjectId.isValid(userId) ||
      !mongoose.Types.ObjectId.isValid(commentId)
    ) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid userId or commentId" });
    }

    // Find and delete the comment
    const comment = await Comment.findOneAndDelete({
      _id: commentId,
      user: userId,
    });

    if (!comment) {
      return res
        .status(404)
        .json({ success: false, message: "Comment not found" });
    }

    // Remove the comment reference from the associated video
    const video = await Video.findOneAndUpdate(
      { comments: commentId }, // Fixed: Use "comments" instead of "Comments"
      { $pull: { comments: commentId } }, // Fixed: Correct field name
      { new: true }
    );

    return res
      .status(200)
      .json({ success: true, message: "Comment deleted successfully" });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.approveLongVideo = async (req, res) => {
  try {
    const user = req.user;
    if (user.role !== "admin") {
      return res
        .status(403)
        .json({ success: false, message: "Only admins can approve videos" });
    }

    const { id } = req.params;
    const video = await Videos.findById(id);
    if (!video) {
      return res
        .status(404)
        .json({ success: false, message: "Video not found" });
    }

    if (video.status === "approved") {
      return res
        .status(400)
        .json({ success: false, message: "Video already approved" });
    }

    video.status = "approved";
    video.approvedBy = user.id; // you may want to add these fields to your schema
    video.approvedAt = new Date();
    await video.save();

    res.json({ success: true, data: video });
  } catch {
    res.status(500).json({ success: false, message: error.message });
  }
};

// exports.updateLongVideo = async (req, res) => {
//   try {
//     const { id } = req.params;
//     const {
//       title,
//       description,
//       thumbnail,
//       video_url,
//       category,
//       videoDuration,
//         magazineType, 
//       newsType,
//     } = req.body;

//     // Validate video ID
//     if (!mongoose.Types.ObjectId.isValid(id)) {
//       return res.status(400).json({
//         success: false,
//         message: "Invalid video ID format",
//       });
//     }

//     // Find existing video
//     const existingVideo = await Videos.findById(id);
//     if (!existingVideo) {
//       return res.status(404).json({
//         success: false,
//         message: "Video not found",
//       });
//     }

//     const isCreator = existingVideo.createdBy?.toString() === req.user.id;
//     const isAdmin = req.user.role === "admin";
//     const isModerator = req.user.role === "moderator";

//     if (!isCreator && !isAdmin && !isModerator) {
//       return res.status(403).json({
//         success: false,
//         message: "Not authorized to update this video",
//       });
//     }

//     // Save current version before update
//     const latestVersion = await LongVideoVersion.find({ videoId: id })
//       .sort({ versionNumber: -1 })
//       .limit(1);
//     const nextVersionNumber = latestVersion.length
//       ? latestVersion[0].versionNumber + 1
//       : 1;

//     await LongVideoVersion.create({
//       videoId: id,
//       snapshot: existingVideo.toObject(),
//       versionNumber: nextVersionNumber,
//       updatedBy: req.user.id,
//       updatedAt: new Date(),
//     });

//     // Prepare update object
//     const updateFields = {
//       last_updated: new Date(),
//     };

//     // Translation logic
//     if (title || description) {
//       const targetLanguages = ["en", "kn", "hi"];
//       const titleToTranslate = title || existingVideo.title;
//       const descToTranslate = description || existingVideo.description;

//       const [titleTranslations, descriptionTranslations] = await Promise.all([
//         Promise.all(
//           targetLanguages.map((lang) =>
//             translate.translate(titleToTranslate, lang)
//           )
//         ),
//         Promise.all(
//           targetLanguages.map((lang) =>
//             translate.translate(descToTranslate, lang)
//           )
//         ),
//       ]);

//       updateFields.title = title || existingVideo.title;
//       updateFields.description = description || existingVideo.description;
//       updateFields.english = {
//         title: titleTranslations[0][0],
//         description: descriptionTranslations[0][0],
//       };
//       updateFields.kannada = {
//         title: titleTranslations[1][0],
//         description: descriptionTranslations[1][0],
//       };
//       updateFields.hindi = {
//         title: titleTranslations[2][0],
//         description: descriptionTranslations[2][0],
//       };
//     }

//     if (thumbnail) updateFields.thumbnail = thumbnail;
//     if (video_url) updateFields.video_url = video_url;
//     if (category) updateFields.category = category;
//     if (videoDuration) updateFields.videoDuration = videoDuration;

//      if (typeof magazineType !== "undefined") {
//       const normalizedMagazine = normalizeMagazineType(magazineType); // you already have this helper
//       if (normalizedMagazine === "invalid") {
//         return res.status(400).json({
//           success: false,
//           message: "Invalid magazineType. Use 'magazine' or 'magazine2'.",
//         });
//       }
//       if (normalizedMagazine === undefined) {
//         // explicit clear (e.g., sending null)
//         updateFields.$unset = { ...(updateFields.$unset || {}), magazineType: "" };
//       } else {
//         updateFields.magazineType = normalizedMagazine;
//       }
//     }

//     // 8) Validate & set/clear newsType tag (matches your enum: "statenews" | "districtnews" | "specialnews")
//     if (typeof newsType !== "undefined") {
//       const normalizedNews = normalizeNewsType(newsType); // add the helper if not present
//       if (normalizedNews === "invalid") {
//         return res.status(400).json({
//           success: false,
//           message: "Invalid newsType. Use 'statenews', 'districtnews', or 'specialnews'.",
//         });
//       }
//       if (normalizedNews === undefined) {
//         updateFields.$unset = { ...(updateFields.$unset || {}), newsType: "" };
//       } else {
//         updateFields.newsType = normalizedNews;
//       }
//     }

    

//     // Set approval status based on user role
//     if (isAdmin) {
//       updateFields.status = "approved";
//     } else {
//       const contentChanged =
//         title || description || thumbnail || video_url || category;
//       updateFields.status = contentChanged ? "pending" : existingVideo.status;
//     }

//     // Perform the update
//     const updatedVideo = await Videos.findByIdAndUpdate(
//       id,
//       { $set: updateFields },
//       { new: true, runValidators: true }
//     );

//     res.status(200).json({
//       success: true,
//       data: updatedVideo,
//       message: isAdmin
//         ? "Video updated and approved"
//         : "Video updated, awaiting admin approval",
//     });
//   } catch (error) {
//     console.error("Update error:", error);
//     res.status(500).json({
//       success: false,
//       message: error.message,
//       error: process.env.NODE_ENV === "development" ? error.stack : undefined,
//     });
//   }
// };

// exports.getLongVideoHistory = async (req, res) => {
//   try {
//     const { id } = req.params;

//     const versions = await LongVideoVersion.find({ videoId: id })
//       .populate("updatedBy", "displayName email")
//       .sort({ versionNumber: -1 });

//     if (!versions.length) {
//       return res
//         .status(404)
//         .json({ success: false, message: "No version history found" });
//     }

//     res.status(200).json({ success: true, data: versions });
//   } catch (error) {
//     res.status(500).json({ success: false, message: error.message });
//   }
// };


// exports.revertLongVideoToVersion = async (req, res) => {
//   try {
//     const { id, versionNumber } = req.params;
//     const currentVersionNumber = parseInt(versionNumber);
//     const targetVersionNumber = currentVersionNumber - 1;

//     // 1) Find the target version to revert TO
//     const targetVersion = await LongVideoVersion.findOne({
//       videoId: id,
//       versionNumber: targetVersionNumber,
//     });

//     if (!targetVersion) {
//       return res
//         .status(404)
//         .json({ success: false, message: "Target version not found." });
//     }

//     // 2) Restore the long video document with the target version's snapshot
//     const restoredVideo = await Videos.findByIdAndUpdate(
//       id,
//       targetVersion.snapshot,
//       { new: true, runValidators: true }
//     );

//     if (!restoredVideo) {
//       return res
//         .status(404)
//         .json({ success: false, message: "Long video not found." });
//     }

//     // 3) Delete the current version that we're reverting FROM
//     await LongVideoVersion.deleteOne({
//       videoId: id,
//       versionNumber: currentVersionNumber,
//     });

//     res.status(200).json({ 
//       success: true, 
//       data: restoredVideo,
//       message: "Reverted and cleaned up successfully" 
//     });
//   } catch (error) {
//     console.error("Error in revertLongVideoToVersion:", error);
//     res.status(500).json({ success: false, message: error.message });
//   }
// };
exports.deleteVideoVersioon = async (req, res) => {
  try {
    const { id, versionNumber } = req.params;

    const deleted = await LongVideoVersion.findOneAndDelete({
      videoId: id,
      versionNumber,
    });
    if (!deleted) {
      return res
        .status(404)
        .json({ success: false, message: "Version not found" });
    }
    const versions = await LongVideoVersion.find({ videoId: id }).sort({
      versionNumber: 1,
    });

    for (let i = 0; i < versions.length; i++) {
      versions[i].versionNumber = i + 1;
      await versions[i].save();
    }

    res
      .status(200)
      .json({
        success: true,
        message: "Version deleted and renumbered successfully",
      });
  } catch (error) {
    console.error("Error in deleteVersion:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// exports.updateLongVideo = async (req, res) => {
//   try {
//     const { id } = req.params;
//     const updatedData = req.body;

//     // Validate video ID
//     if (!mongoose.Types.ObjectId.isValid(id)) {
//       return res.status(400).json({
//         success: false,
//         message: "Invalid video ID format",
//       });
//     }

//     // Find existing video
//     const existingVideo = await Videos.findById(id);
//     if (!existingVideo) {
//       return res.status(404).json({
//         success: false,
//         message: "Video not found",
//       });
//     }

//     const isCreator = existingVideo.createdBy?.toString() === req.user.id;
//     const isAdmin = req.user.role === "admin";
//     const isModerator = req.user.role === "moderator";

//     if (!isCreator && !isAdmin && !isModerator) {
//       return res.status(403).json({
//         success: false,
//         message: "Not authorized to update this video",
//       });
//     }

//     // STEP 1: Save version snapshot of CURRENT state BEFORE updates
//     const versionCount = await LongVideoVersion.countDocuments({ videoId: id });
//     const currentVersionNumber = versionCount + 1;
    
//     await LongVideoVersion.create({
//       videoId: id,
//       versionNumber: currentVersionNumber,
//       updatedBy: req.user.id,
//       updatedAt: new Date(),
//       snapshot: {
//         title: existingVideo.title,
//         description: existingVideo.description,
//         english: existingVideo.english,
//         kannada: existingVideo.kannada,
//         hindi: existingVideo.hindi,
//         thumbnail: existingVideo.thumbnail,
//         video_url: existingVideo.video_url,
//         category: existingVideo.category,
//         videoDuration: existingVideo.videoDuration,
//         magazineType: existingVideo.magazineType,
//         newsType: existingVideo.newsType,
//         status: existingVideo.status,
//         // Include all fields that can be updated
//       },
//     });

    
//     if (updatedData.title) existingVideo.title = updatedData.title;
//     if (updatedData.description) existingVideo.description = updatedData.description;
//     if (updatedData.thumbnail) existingVideo.thumbnail = updatedData.thumbnail;
//     if (updatedData.video_url) existingVideo.video_url = updatedData.video_url;
//     if (updatedData.category) existingVideo.category = updatedData.category;
//     if (updatedData.videoDuration) existingVideo.videoDuration = updatedData.videoDuration;

//     // Handle magazineType and newsType with validation
//     if (updatedData.magazineType !== undefined) {
//       const normalizedMagazine = normalizeMagazineType(updatedData.magazineType);
//       if (normalizedMagazine === "invalid") {
//         return res.status(400).json({
//           success: false,
//           message: "Invalid magazineType. Use 'magazine' or 'magazine2'.",
//         });
//       }
//       existingVideo.magazineType = normalizedMagazine;
//     }

//     if (updatedData.newsType !== undefined) {
//       const normalizedNews = normalizeNewsType(updatedData.newsType);
//       if (normalizedNews === "invalid") {
//         return res.status(400).json({
//           success: false,
//           message: "Invalid newsType. Use 'statenews', 'districtnews', or 'specialnews'.",
//         });
//       }
//       existingVideo.newsType = normalizedNews;
//     }

//     // Handle translations if title or description changed
//     if (updatedData.title || updatedData.description) {
//       const targetLanguages = ["en", "kn", "hi"];
//       const titleToTranslate = updatedData.title || existingVideo.title;
//       const descToTranslate = updatedData.description || existingVideo.description;

//       const [titleTranslations, descriptionTranslations] = await Promise.all([
//         Promise.all(targetLanguages.map((lang) => translate.translate(titleToTranslate, lang))),
//         Promise.all(targetLanguages.map((lang) => translate.translate(descToTranslate, lang))),
//       ]);

//       existingVideo.english = {
//         title: titleTranslations[0][0],
//         description: descriptionTranslations[0][0],
//       };
//       existingVideo.kannada = {
//         title: titleTranslations[1][0],
//         description: descriptionTranslations[1][0],
//       };
//       existingVideo.hindi = {
//         title: titleTranslations[2][0],
//         description: descriptionTranslations[2][0],
//       };
//     }

//     existingVideo.last_updated = new Date();
    
//     // Role-based status
//     if (req.user.role === "moderator") {
//       existingVideo.status = "pending";
//     } else if (req.user.role === "admin") {
//       existingVideo.status = "approved";
//     }

//     const updatedVideo = await existingVideo.save();
    
   
//     res.status(200).json({
//       success: true,
//       data: updatedVideo,
//       message: "Long video updated successfully",
//     });
//   } catch (error) {
//     console.error("Update error:", error);
//     res.status(500).json({
//       success: false,
//       message: error.message,
//     });
//   }
// };

exports.updateLongVideo = async (req, res) => {
  try {
    const { id } = req.params;
    const updatedData = req.body;

    // Validate video ID
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid video ID format",
      });
    }

    // Find existing video
    const existingVideo = await Videos.findById(id);
    if (!existingVideo) {
      return res.status(404).json({
        success: false,
        message: "Video not found",
      });
    }

    // AuthZ
    const isCreator = existingVideo.createdBy?.toString() === req.user.id;
    const isAdmin = req.user.role === "admin";
    const isModerator = req.user.role === "moderator";
    if (!isCreator && !isAdmin && !isModerator) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to update this video",
      });
    }

    // STEP 1: Save version snapshot of CURRENT state BEFORE updates
    const versionCount = await LongVideoVersion.countDocuments({ videoId: id });
    const currentVersionNumber = versionCount + 1;

    await LongVideoVersion.create({
      videoId: id,
      versionNumber: currentVersionNumber,
      updatedBy: req.user.id,
      updatedAt: new Date(),
      snapshot: {
        title: existingVideo.title,
        description: existingVideo.description,
        // Keeping these if they exist in schema; they won't be re-generated
        english: existingVideo.english,
        kannada: existingVideo.kannada,
        hindi: existingVideo.hindi,
        thumbnail: existingVideo.thumbnail,
        video_url: existingVideo.video_url,
        category: existingVideo.category,
        videoDuration: existingVideo.videoDuration,
        magazineType: existingVideo.magazineType,
        newsType: existingVideo.newsType,
        status: existingVideo.status,
      },
    });

    // STEP 2: Apply updates (NO translation)
    if (updatedData.title !== undefined) existingVideo.title = updatedData.title;
    if (updatedData.description !== undefined) existingVideo.description = updatedData.description;
    if (updatedData.thumbnail !== undefined) existingVideo.thumbnail = updatedData.thumbnail;
    if (updatedData.video_url !== undefined) existingVideo.video_url = updatedData.video_url;
    if (updatedData.category !== undefined) existingVideo.category = updatedData.category;
    if (updatedData.videoDuration !== undefined) existingVideo.videoDuration = updatedData.videoDuration;

    // Validate & set magazineType
    if (updatedData.magazineType !== undefined) {
      const normalizedMagazine = normalizeMagazineType(updatedData.magazineType);
      if (normalizedMagazine === "invalid") {
        return res.status(400).json({
          success: false,
          message: "Invalid magazineType. Use 'magazine' or 'magazine2'.",
        });
      }
      existingVideo.magazineType = normalizedMagazine;
    }

    // Validate & set newsType
    if (updatedData.newsType !== undefined) {
      const normalizedNews = normalizeNewsType(updatedData.newsType);
      if (normalizedNews === "invalid") {
        return res.status(400).json({
          success: false,
          message: "Invalid newsType. Use 'statenews', 'districtnews', or 'specialnews'.",
        });
      }
      existingVideo.newsType = normalizedNews;
    }

    // ❌ Removed: translation of title/description

    existingVideo.last_updated = new Date();

    // Role-based status
    if (req.user.role === "moderator") {
      existingVideo.status = "pending";
    } else if (req.user.role === "admin") {
      existingVideo.status = "approved";
    }

    const updatedVideo = await existingVideo.save();

    res.status(200).json({
      success: true,
      data: updatedVideo,
      message: "Long video updated successfully",
    });
  } catch (error) {
    console.error("Update error:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};


exports.getLongVideoHistory = async (req, res) => {
  try {
    const { id } = req.params;

    const versions = await LongVideoVersion.find({ videoId: id })
      .populate("updatedBy", "displayName email")
      .sort({ versionNumber: -1 });

    if (!versions.length) {
      return res
        .status(404)
        .json({ success: false, message: "No version history found" });
    }

    // Debug: Check what titles are stored in versions
    versions.forEach(version => {
      // console.log(`Long Video Version ${version.versionNumber} title: ${version.snapshot.title}`);
    });

    res.status(200).json({ success: true, data: versions });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// CORRECTED: Proper revert logic
exports.revertLongVideoToVersion = async (req, res) => {
  try {
    const { id, versionNumber } = req.params;
    const currentVersionNumber = parseInt(versionNumber);
    
    // We want to revert TO this target version
    const targetVersionNumber = currentVersionNumber - 1;

   
    const targetVersion = await LongVideoVersion.findOne({
      videoId: id,
      versionNumber: targetVersionNumber,
    });

    if (!targetVersion) {
      return res
        .status(404)
        .json({ success: false, message: `Target version ${targetVersionNumber} not found.` });
    }

    const restoredVideo = await Videos.findByIdAndUpdate(
      id,
      targetVersion.snapshot,
      { new: true, runValidators: true }
    );

    if (!restoredVideo) {
      return res
        .status(404)
        .json({ success: false, message: "Long video not found." });
    }

    
    // Delete the current version that we're reverting FROM
    const deleteResult = await LongVideoVersion.deleteOne({
      videoId: id,
      versionNumber: currentVersionNumber,
    });

   
    res.status(200).json({ 
      success: true, 
      data: restoredVideo,
      message: `Successfully reverted to version ${targetVersionNumber}` 
    });
  } catch (error) {
    console.error("Error in revertLongVideoToVersion:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};



const User = require("../models/userModel");

// ➕ Add a long video to playlist
exports.addLongVideoToPlaylist = async (req, res) => {
  try {
    const { userId, videoId } = req.body;

    if (!userId || !videoId) {
      return res
        .status(400)
        .json({ success: false, message: "userId and videoId are required" });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    const longVideo = await Videos.findById(videoId);
    if (!longVideo)
      return res.status(404).json({ success: false, message: "Long video not found" });

    // Prevent duplicates
    const alreadyExists = user.playlist?.longvideoplaylist?.some(
      (item) => item.videoId.toString() === videoId
    );
    if (alreadyExists)
      return res
        .status(400)
        .json({ success: false, message: "Video already in playlist" });

    user.playlist.longvideoplaylist.push({ videoId });
    await user.save();

    res.status(200).json({
      success: true,
      message: "Long video added to playlist successfully",
      playlist: user.playlist.longvideoplaylist,
    });
  } catch (error) {
    console.error("Error adding long video to playlist:", error);
    res.status(500).json({ success: false, message: "Server error", error });
  }
};

// ➖ Remove a long video from playlist
exports.removeLongVideoFromPlaylist = async (req, res) => {
  try {
    const { userId, videoId } = req.body;

    // Validate input
    if (!userId || !videoId) {
      return res
        .status(400)
        .json({ success: false, message: "userId and videoId are required" });
    }

    // Find the user
    const user = await User.findById(userId);
    if (!user)
      return res.status(404).json({ success: false, message: "User not found" });

    // Defensive checks
    if (!user.playlist) user.playlist = {};
    if (!user.playlist.longvideoplaylist)
      user.playlist.longvideoplaylist = [];

    // Remove the video
    user.playlist.longvideoplaylist = user.playlist.longvideoplaylist.filter(
      (item) => item.videoId && item.videoId.toString() !== videoId
    );

    // Save updated playlist
    await user.save();

    res.status(200).json({
      success: true,
      message: "Long video removed from playlist successfully",
      playlist: user.playlist.longvideoplaylist,
    });
  } catch (error) {
    console.error("Error removing long video from playlist:", error);
    res
      .status(500)
      .json({ success: false, message: "Server error", error });
  }
};

// 📄 Get user's long video playlist
exports.getLongVideoPlaylist = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId).populate(
      "playlist.longvideoplaylist.videoId"
    );
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    res.status(200).json({
      success: true,
      playlist: user.playlist.longvideoplaylist,
    });
  } catch (error) {
    console.error("Error fetching long video playlist:", error);
    res.status(500).json({ success: false, message: "Server error", error });
  }
};
