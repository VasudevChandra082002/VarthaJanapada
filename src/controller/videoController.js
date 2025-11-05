const Videos = require("../models/videoModel");
const Comment = require("../models/commentsModel");
const VideoVersion = require("../models/videoVersionModel");


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



// const { Translate } = require("@google-cloud/translate").v2;

// const base64Key = process.env.GOOGLE_CLOUD_KEY_BASE64;
// if (!base64Key) {
//   throw new Error(
//     "GOOGLE_CLOUD_KEY_BASE64 is not set in environment variables"
//   );
// }
// const credentials = JSON.parse(
//   Buffer.from(base64Key, "base64").toString("utf-8")
// );

// const translate = new Translate({ credentials });


// exports.uploadVideo = async (req, res) => {
//   try {
//     const { title, description, thumbnail, video_url, category } = req.body;

//     // Validate required fields
//     if (!title || !description || !thumbnail || !video_url || !category) {
//       return res.status(400).json({
//         success: false,
//         message:
//           "Please provide all required fields: title, description, videoThumbnail, videoUrl, category",
//       });
//     }

//     // Define the target languages for translation
//     const targetLanguages = ["en", "kn", "hi"]; // English, Kannada, Hindi

//     // Translate the title and description into each language individually
//     const titleTranslations = await Promise.all(
//       targetLanguages.map(async (lang) => {
//         return await translate.translate(title, lang);
//       })
//     );

//     const descriptionTranslations = await Promise.all(
//       targetLanguages.map(async (lang) => {
//         return await translate.translate(description, lang);
//       })
//     );

//     // Create a new video object with the translations
//     const newVideo = new Videos({
//       title, // Original title
//       description, // Original description
//       english: {
//         title: titleTranslations[0][0], // English translation of the title
//         description: descriptionTranslations[0][0], // English translation of description
//       },
//       kannada: {
//         title: titleTranslations[1][0], // Kannada translation of the title
//         description: descriptionTranslations[1][0], // Kannada translation of description
//       },
//       hindi: {
//         title: titleTranslations[2][0], // Hindi translation of the title
//         description: descriptionTranslations[2][0], // Hindi translation of description
//       },
//       thumbnail,
//       video_url,
//       category, // Assuming 'category' is passed in the request body
//       videoDuration: req.body.videoDuration, // Optional, if provided
//       last_updated: new Date(),
//       createdBy: req.user.id,
//       status: req.user.role === "admin" ? "approved" : "pending",
//     });
//     console.log(newVideo);
//     // Save the new video to the database
//     const savedVideo = await newVideo.save();

//     res.status(201).json({ success: true, data: savedVideo });
//   } catch (error) {
//     res.status(500).json({ success: false, message: error.message });
//   }
// };


// controllers/videoController.js
// controllers/videoController.js

exports.uploadVideo = async (req, res) => {
  try {
    const { title, description, thumbnail, video_url, category, magazineType, newsType } = req.body;

    if (!title || !description || !thumbnail || !video_url || !category) {
      return res.status(400).json({
        success: false,
        message: "Please provide: title, description, thumbnail, video_url, category",
      });
    }

    // 🔹 validate magazineType tag (optional)
    const normalizedMagazine = normalizeMagazineType(magazineType);
    if (normalizedMagazine === "invalid") {
      return res.status(400).json({
        success: false,
        message: "Invalid magazineType. Use 'magazine' or 'magazine2'.",
      });
    }

    // 🔹 validate newsType tag (optional)
    const normalizedNews = normalizeNewsType(newsType);
    if (normalizedNews === "invalid") {
      return res.status(400).json({
        success: false,
        message: "Invalid newsType. Use 'statenews', 'districtnews', or 'specialnews'.",
      });
    }

    // translations (unchanged)
    // const targetLanguages = ["en", "kn", "hi"];
    // const [titleTranslations, descriptionTranslations] = await Promise.all([
    //   Promise.all(targetLanguages.map((lang) => translate.translate(title, lang))),
    //   Promise.all(targetLanguages.map((lang) => translate.translate(description, lang))),
    // ]);

    const newVideo = new Videos({
      title,
      description,
      // english: { title: titleTranslations[0][0], description: descriptionTranslations[0][0] },
      // kannada: { title: titleTranslations[1][0], description: descriptionTranslations[1][0] },
      // hindi: { title: titleTranslations[2][0], description: descriptionTranslations[2][0] },
      thumbnail,
      video_url,
      category,
      videoDuration: req.body.videoDuration,
      last_updated: new Date(),
      createdBy: req.user.id,
      status: req.user.role === "admin" ? "approved" : "pending",
      magazineType: normalizedMagazine,   // undefined if not provided
      newsType: normalizedNews,           // undefined if not provided
    });

    const savedVideo = await newVideo.save();
    res.status(201).json({ success: true, data: savedVideo });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};




exports.getAllVideos = async (req, res) => {
  try {
    const videos = await Videos.find().populate({
      path: "Comments", // Populate the Comments array
      populate: {
        // Populate the 'user' field within each comment
        path: "user", // Assuming your Comment model has a 'user' field referencing the User model
        select: "displayName profileImage", // Select which fields from the user you want to include (important for performance)
      },
    })
     .populate("createdBy")
      .populate({
      path: "category",
      select: "name", // Select only the 'name' field from the Category model
    });

    res.status(200).json({ success: true, data: videos });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getVideoId = async (req, res) => {
  try {
    const video = await Videos.findById(req.params.id).populate({
      path: "Comments",
      populate: {
        path: "user",
        select: "displayName profileImage", // Select the fields you need
      },
    });
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

    const video = await Videos.findById(videoId);
    if (!video) {
      return res
        .status(404)
        .json({ success: false, message: "Video not found" });
    }

    const newComment = new Comment({
      // Create a new Comment document
      user: userId,
      video: videoId,
      comment: text,
    });

    const savedComment = await newComment.save(); // Save the comment FIRST

    video.Comments.push(savedComment._id); // Push the comment's _id into the video's comments array
    await video.save(); // Save the updated video

    res.status(201).json({ success: true, data: savedComment }); // Respond with the saved comment
  } catch (error) {
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
exports.getTotalNumberOfVideos = async (req, res) => {
  try {
    const count = await Videos.countDocuments();
    res.status(200).json({ success: true, data: count });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
exports.getMostLikedVideo = async (req, res) => {
  try {
    // Find the video with the highest number of likes
    const mostLikedVideo = await Videos.findOne().sort({ total_likes: -1 });

    // Check if a video was found
    if (!mostLikedVideo) {
      return res.status(404).json({
        success: false,
        message: "No videos found",
      });
    }

    // Return the most liked video
    res.status(200).json({
      success: true,
      data: mostLikedVideo,
    });
  } catch (error) {
    console.error("Error fetching most liked video:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};




exports.approveVideo = async (req, res) => {
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
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};



exports.updateVideo = async (req, res) => {
  try {
    const { id } = req.params;
    const updatedData = req.body;

    const video = await Videos.findById(id);
    if (!video) {
      return res.status(404).json({ success: false, message: "Video not found" });
    }

    // STEP 1: Save version snapshot of CURRENT state BEFORE updates
    const versionCount = await VideoVersion.countDocuments({ videoId: id });
    const currentVersionNumber = versionCount + 1;

    await VideoVersion.create({
      videoId: video._id,
      versionNumber: currentVersionNumber,
      updatedBy: req.user.id,
      snapshot: {
        title: video.title,
        description: video.description,
        english: video.english,   // keeping snapshot as-is (no new translations created)
        kannada: video.kannada,
        hindi: video.hindi,
        thumbnail: video.thumbnail,
        video_url: video.video_url,
        category: video.category,
        videoDuration: video.videoDuration,
        magazineType: video.magazineType,
        newsType: video.newsType,
        status: video.status,
      },
    });

  
    // STEP 2: Apply updates to the video (no translation)
    if (updatedData.title !== undefined) video.title = updatedData.title;
    if (updatedData.description !== undefined) video.description = updatedData.description;
    if (updatedData.thumbnail !== undefined) video.thumbnail = updatedData.thumbnail;
    if (updatedData.video_url !== undefined) video.video_url = updatedData.video_url;
    if (updatedData.category !== undefined) video.category = updatedData.category;
    if (updatedData.videoDuration !== undefined) video.videoDuration = updatedData.videoDuration;

    // Validate & set magazineType
    if (updatedData.magazineType !== undefined) {
      const normalizedMagazine = normalizeMagazineType(updatedData.magazineType);
      if (normalizedMagazine === "invalid") {
        return res.status(400).json({
          success: false,
          message: "Invalid magazineType. Use 'magazine' or 'magazine2'.",
        });
      }
      video.magazineType = normalizedMagazine;
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
      video.newsType = normalizedNews;
    }

    // NO translation block here anymore

    video.last_updated = new Date();

    // Role-based status
    if (req.user.role === "moderator") {
      video.status = "pending";
    } else if (req.user.role === "admin") {
      video.status = "approved";
    }

    const updatedVideo = await video.save();

    res.status(200).json({
      success: true,
      data: updatedVideo,
      message: "Video updated successfully",
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};


// CORRECTED: Proper revert logic
exports.revertVideoToVersion = async (req, res) => {
  try {
    const { id, versionNumber } = req.params;
    const currentVersionNumber = parseInt(versionNumber);
    
    // We want to revert TO this target version
    const targetVersionNumber = currentVersionNumber - 1;

 
    // Find the target version we want to revert TO
    const targetVersion = await VideoVersion.findOne({
      videoId: id,
      versionNumber: targetVersionNumber,
    });

    if (!targetVersion) {
      return res.status(404).json({ 
        success: false, 
        message: `Target version ${targetVersionNumber} not found.` 
      });
    }

  
    // Restore the video to the target version state
    const restoredVideo = await Videos.findByIdAndUpdate(
      id,
      targetVersion.snapshot,
      { new: true, runValidators: true }
    );

    if (!restoredVideo) {
      return res.status(404).json({ 
        success: false, 
        message: "Video not found." 
      });
    }

   
    // Delete the current version that we're reverting FROM
    const deleteResult = await VideoVersion.deleteOne({
      videoId: id,
      versionNumber: currentVersionNumber,
    });

  
    res.status(200).json({ 
      success: true, 
      data: restoredVideo,
      message: `Successfully reverted to version ${targetVersionNumber}` 
    });
  } catch (error) {
    console.error("Error in revertVideoToVersion:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// CORRECTED: Get version history with proper data
exports.getVideoHistory = async (req, res) => {
  try {
    const { id } = req.params;

    const versions = await VideoVersion.find({ videoId: id })
      .populate("updatedBy", "displayName email")
      .sort({ versionNumber: -1 });

    if (!versions.length) {
      return res.status(404).json({ success: false, message: "No version history found" });
    }

    // Debug: Check what titles are stored in versions
    versions.forEach(version => {
      console.log(`Version ${version.versionNumber} title: ${version.snapshot.title}`);
    });

    res.status(200).json({ success: true, data: versions });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// UPDATED: Consistent version deletion logic with magazine controller
exports.deleteVersion = async (req, res) => {
  try {
    const { id, versionNumber } = req.params;

    const deleted = await VideoVersion.findOneAndDelete({
      videoId: id,
      versionNumber,
    });

    if (!deleted) {
      return res.status(404).json({ success: false, message: "Version not found" });
    }

    // Consistent with magazine: renumber remaining versions
    const remainingVersions = await VideoVersion.find({ videoId: id }).sort({ versionNumber: 1 });
    for (let i = 0; i < remainingVersions.length; i++) {
      remainingVersions[i].versionNumber = i + 1;
      await remainingVersions[i].save();
    }

    res.status(200).json({
      success: true,
      message: "Version deleted and renumbered successfully",
    });
  } catch (error) {
    console.error("Error in deleteVersion:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};




const User = require("../models/userModel");

exports.addShortVideoToPlaylist = async (req, res) => {
  try {
    const { userId, videoId } = req.body;

    if (!userId || !videoId) {
      return res.status(400).json({ success: false, message: "userId and videoId are required" });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    const video = await Videos.findById(videoId);
    if (!video) return res.status(404).json({ success: false, message: "Video not found" });

    // Prevent duplicates
    const alreadyExists = user.playlist?.shortvideoplaylist?.some(
      (item) => item.videoId.toString() === videoId
    );
    if (alreadyExists)
      return res.status(400).json({ success: false, message: "Video already in playlist" });

    user.playlist.shortvideoplaylist.push({ videoId });
    await user.save();

    res.status(200).json({
      success: true,
      message: "Short video added to playlist successfully",
      playlist: user.playlist.shortvideoplaylist,
    });
  } catch (error) {
    console.error("Error adding short video to playlist:", error);
    res.status(500).json({ success: false, message: "Server error", error });
  }
};

// ➖ Remove a short video from playlist
exports.removeShortVideoFromPlaylist = async (req, res) => {
  try {
    const { userId, videoId } = req.body;

    // Validate input
    if (!userId || !videoId) {
      return res
        .status(400)
        .json({ success: false, message: "userId and videoId are required" });
    }

    // Find user
    const user = await User.findById(userId);
    if (!user)
      return res.status(404).json({ success: false, message: "User not found" });

    // Ensure playlist structure exists
    if (!user.playlist) user.playlist = {};
    if (!user.playlist.shortvideoplaylist)
      user.playlist.shortvideoplaylist = [];

    // Filter out the video
    user.playlist.shortvideoplaylist = user.playlist.shortvideoplaylist.filter(
      (item) => item.videoId && item.videoId.toString() !== videoId
    );

    // Save changes
    await user.save();

    res.status(200).json({
      success: true,
      message: "Short video removed from playlist successfully",
      playlist: user.playlist.shortvideoplaylist,
    });
  } catch (error) {
    console.error("Error removing short video from playlist:", error);
    res
      .status(500)
      .json({ success: false, message: "Server error", error });
  }
};


// 📄 Get user’s short video playlist
exports.getShortVideoPlaylist = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId).populate(
      "playlist.shortvideoplaylist.videoId"
    );
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    res.status(200).json({
      success: true,
      playlist: user.playlist.shortvideoplaylist,
    });
  } catch (error) {
    console.error("Error fetching short video playlist:", error);
    res.status(500).json({ success: false, message: "Server error", error });
  }
};
