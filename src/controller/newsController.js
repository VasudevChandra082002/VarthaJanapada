


const News = require("../models/newsModel");
const Category = require("../models/categoryModel");
const Tags = require("../models/tagsModel");
const Comment = require("../models/commentsModel");
const mongoose = require("mongoose");
const NewsVersion = require("../models/newsVersionModel");
const User = require("../models/userModel");

// --- helpers (unchanged) ---
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
  if (["statenews", "state", "state_news"].includes(s)) return "statenews";
  if (["districtnews", "district", "district_news"].includes(s)) return "districtnews";
  if (["specialnews", "special", "special_news"].includes(s)) return "specialnews";
  return "invalid";
}

// --- controller without translation ---
exports.createNews = async (req, res) => {
  try {
    const { category, tags, ...newsData } = req.body;

    // Validate category
    const categoryExists = await Category.findById(category);
    if (!categoryExists) {
      return res.status(400).json({ success: false, message: "Invalid category ID" });
    }

    // Validate tags
    if (tags && tags.length > 0) {
      const existingTags = await Tags.find({ _id: { $in: tags } });
      if (existingTags.length !== tags.length) {
        return res.status(400).json({ success: false, message: "One or more tags are invalid" });
      }
    }

    // Normalize types
    const normalizedMagazine = normalizeMagazineType(newsData.magazineType);
    if (normalizedMagazine === "invalid") {
      return res
        .status(400)
        .json({ success: false, message: "Invalid magazineType. Use 'magazine' or 'magazine2'." });
    }

    const normalizedNews = normalizeNewsType(newsData.newsType);
    if (normalizedNews === "invalid") {
      return res.status(400).json({
        success: false,
        message: "Invalid newsType. Use 'statenews', 'districtnews', or 'specialnews'.",
      });
    }

    // Build doc WITHOUT translations
    const news = new News({
      ...newsData,
      category,
      tags,
      magazineType: normalizedMagazine,
      newsType: normalizedNews,
      createdBy: req.user.id,
      status: req.user.role === "admin" ? "approved" : "pending",
    });

    const savedNews = await news.save();
    res.status(201).json({ success: true, data: savedNews });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};



exports.translateNews = async (req, res) => {
  try {
    const { id, targetLang } = req.params;

    if (!["en", "kn", "hi"].includes(targetLang)) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid language code. Use 'en' for English, 'kn' for Kannada, or 'hi' for Hindi.",
      });
    }

    const news = await News.findById(id);
    if (!news) {
      return res
        .status(404)
        .json({ success: false, message: "News not found" });
    }

    let translatedTitle = news.title;
    let translatedDescription = news.description;

    if (targetLang === "hi") {
      translatedTitle = news.hindi.title;
      translatedDescription = news.hindi.description;
    } else if (targetLang === "kn") {
      translatedTitle = news.kannada.title;
      translatedDescription = news.kannada.description;
    } else if (targetLang === "en") {
      translatedTitle = news.English.title;
      translatedDescription = news.English.description;
    }

    res.status(200).json({
      success: true,
      original: { title: news.title, description: news.description },
      translated: {
        title: translatedTitle,
        description: translatedDescription,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
exports.getAllNews = async (req, res) => {
  try {
    const newsList = await News.find({ isLive: true })
      .sort({ createdTime: -1 })
      .populate("category")
      .populate("tags", "name")
      .populate("createdBy")
      .sort({ createdTime: -1 });

    res.status(200).json({ success: true, data: newsList });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getNewsById = async (req, res) => {
  try {
    const news = await News.findById(req.params.id)
      .populate("category")
      .populate("tags", "name")
      .populate({
        path: "comments", // Populate the comments field
        populate: { path: "user", select: "displayName profileImage" }, // Optionally populate the user who commented
      });

    if (!news) {
      return res
        .status(404)
        .json({ success: false, message: "News not found" });
    }
    res.status(200).json({ success: true, data: news });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateNews = async (req, res) => {
  try {
    const { category, tags, hindi, kannada, English, magazineType, newsType, ...updateData } = req.body;

    const news = await News.findById(req.params.id);
    if (!news) return res.status(404).json({ success: false, message: "News not found" });

    // 1) Version snapshot BEFORE mutation
    const versionCount = await NewsVersion.countDocuments({ newsId: news._id });
    await NewsVersion.create({
      newsId: news._id,
      updatedBy: req.user.id,
      versionNumber: versionCount + 1,
      snapshot: news.toObject(),
    });

    // 2) Optional: validate category
    if (category) {
      const categoryExists = await Category.findById(category);
      if (!categoryExists) {
        return res.status(400).json({ success: false, message: "Invalid category ID" });
      }
      news.category = category;
    }

    // 3) Optional: validate tags
    if (Array.isArray(tags)) {
      const existingTags = await Tags.find({ _id: { $in: tags } });
      if (existingTags.length !== tags.length) {
        return res.status(400).json({ success: false, message: "One or more tags are invalid" });
      }
      news.tags = tags;
    }

    // 4) Normalize + validate magazineType/newsType; allow clearing with null
    if (typeof magazineType !== "undefined") {
      const normalizedMagazine = normalizeMagazineType(magazineType);
      if (normalizedMagazine === "invalid") {
        return res.status(400).json({
          success: false,
          message: "Invalid magazineType. Use 'magazine' or 'magazine2'.",
        });
      }
      if (normalizedMagazine === undefined) {
        news.magazineType = undefined; // clear
      } else {
        news.magazineType = normalizedMagazine;
      }
    }

    if (typeof newsType !== "undefined") {
      const normalizedNews = normalizeNewsType(newsType);
      if (normalizedNews === "invalid") {
        return res.status(400).json({
          success: false,
          message: "Invalid newsType. Use 'statenews', 'districtnews', or 'specialnews'.",
        });
      }
      if (normalizedNews === undefined) {
        news.newsType = undefined; // clear
      } else {
        news.newsType = normalizedNews;
      }
    }

    // 5) Patch language blocks (partial allowed)
    if (hindi)   news.hindi   = { ...news.hindi,   ...hindi };
    if (kannada) news.kannada = { ...news.kannada, ...kannada };
    if (English) news.English = { ...news.English, ...English };

    // 6) Remaining fields (title, description, isLive, author, etc.)
    Object.assign(news, updateData);

    // 7) Status & bookkeeping
    news.isLive = true; // your current behavior
    news.last_updated = new Date();
    news.status = req.user.role === "admin" ? "approved" : "pending";
    news.createdBy = req.user.id;

    const updatedNews = await news.save();
    res.status(200).json({ success: true, data: updatedNews });
  } catch (error) {
    console.error("Update News Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};





exports.deleteNews = async (req, res) => {
  try {
    const news = await News.findByIdAndDelete(req.params.id);
    if (!news) {
      return res
        .status(404)
        .json({ success: false, message: "News not found" });
    }
    res
      .status(200)
      .json({ success: true, message: "News deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.recommendCategory = async (req, res) => {
  try {
    const userId = req.user.id;

    // Fetch the user's clicked news
    const user = await User.findById(userId).populate("clickedNews.newsId");
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    const categoryCount = {};
    user.clickedNews.forEach((clickedItem) => {
      const categoryId = clickedItem.newsId.category._id.toString();
      categoryCount[categoryId] = (categoryCount[categoryId] || 0) + 1;
    });

    const sortedCategoryIds = Object.keys(categoryCount).sort(
      (a, b) => categoryCount[b] - categoryCount[a]
    );

    const topCategoryId = sortedCategoryIds[0];
    const topCategory = await Category.findById(topCategoryId);

    if (!topCategory) {
      return res
        .status(404)
        .json({ success: false, message: "Category not found" });
    }

    const recommendedNews = await News.find({ category: topCategoryId })
      .sort({ createdTime: -1 })
      .limit(5)
      .populate("category", "name")
      .populate("tags", "name");

    res.status(200).json({
      success: true,
      data: recommendedNews,
      recommendedCategory: topCategory.name,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.searchNews = async (req, res) => {
  try {
    const { query } = req.params;
    if (!query) {
      return res.status(400).json({
        success: false,
        message: "Search query is required",
      });
    }

    const newsList = await News.find({
      title: { $regex: query, $options: "i" },
    })
      .sort({ createdTime: -1 })
      .populate("category", "name")
      .populate("tags", "name");

    if (newsList.length === 0) {
      return res.status(404).json({
        success: false,
        data: [],
        message: "No news articles found matching the search criteria",
      });
    }

    res.status(200).json({ success: true, data: newsList });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
exports.addComment = async (req, res) => {
  try {
    const { userId, newsId, text } = req.body;

    if (!userId || !newsId || !text) {
      return res.status(400).json({
        success: false,
        message: "User ID, News ID, and text are required",
      });
    }

    const newComment = new Comment({
      user: userId,
      news: newsId,
      comment: text,
    });
    const savedComment = await newComment.save();

    // Push the comment to the news document's comments array
    await News.findByIdAndUpdate(newsId, {
      $push: { comments: savedComment._id },
    });

    res.status(201).json({ success: true, data: savedComment });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteComment = async (req, res) => {
  try {
    const { commentId, userId } = req.params;

    const comment = await Comment.findOneAndDelete({
      _id: commentId,
      user: userId,
    });
    if (!comment) {
      return res.status(404).json({
        success: false,
        message: "Comment not found or you do not have permission to delete it",
      });
    }

    res.status(200).json({
      success: true,
      message: "Comment deleted successfully",
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getLatestNews = async (req, res) => {
  try {
    const latestNews = await News.find({ isLive: true })
      .sort({ createdTime: -1 }) // Sort by newest first
      .limit(10) // Get only the latest 10 news articles
      .populate("category") // Populate category name
      .populate("tags", "name"); // Populate tags name

    res.status(200).json({ success: true, data: latestNews });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
exports.getNewsByCategory = async (req, res) => {
  try {
    const { category } = req.params;

    // Ensure the category exists in the database before querying news
    const categoryExists = await Category.findById(category);
    if (!categoryExists) {
      return res
        .status(404)
        .json({ success: false, message: "Category not found" });
    }

    // Find news by category (No need for ObjectId conversion, use string comparison)
    const news = await News.find({ category: category, isLive: true })
      .populate("category")
      .populate("tags", "name");

    if (!news || news.length === 0) {
      return res.status(200).json({
        success: false,
        message: "No news articles found for this category",
        data: [],
      });
    }

    res.status(200).json({ success: true, data: news });
  } catch (error) {
    res.status(200).json({ success: false, message: error.message, data: [] });
  }
};

exports.getTotalNews = async (req, res) => {
  try {
    const totalNews = await News.countDocuments();
    res.status(200).json({ success: true, data: totalNews });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.approveNews = async (req, res) => {
  try {
    const user = req.user; // assume req.user is set by your auth middleware
    if (user.role !== "admin") {
      return res
        .status(403)
        .json({ success: false, message: "Only admins can approve news" });
    }

    const { id } = req.params;
    const news = await News.findById(id);
    if (!news) {
      return res
        .status(404)
        .json({ success: false, message: "News not found" });
    }

    if (news.status === "approved") {
      return res
        .status(400)
        .json({ success: false, message: "News already approved" });
    }

    news.status = "approved";
    news.approvedBy = user.id; // you may want to add these fields to your schema
    news.approvedAt = new Date();
    await news.save();

    res.json({ success: true, data: news });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getNewsHistory = async (req, res) => {
  try {
    const { id } = req.params;
    const history = await NewsVersion.find({ newsId: id })
      .populate("updatedBy", "displayName email")
      .sort({ versionNumber: -1 }); // latest version first

    if (!history.length) {
      return res.status(404).json({
        success: false,
        message: "No version history found for this news article",
        data: [],
      });
    }

    res.status(200).json({ success: true, data: history });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};



// exports.revertNewsToVersion = async (req, res) => {
//   try {
//     const { id, versionNumber } = req.params;

//     const version = await NewsVersion.findOne({ newsId: id, versionNumber });
//     if (!version) {
//       return res.status(404).json({ success: false, message: "Version not found" });
//     }

//     // Perform a raw update to prevent version tracking middleware
//     await News.updateOne({ _id: id }, version.snapshot);

//     const updatedNews = await News.findById(id);

//     res.status(200).json({ success: true, data: updatedNews });
//   } catch (error) {
//     console.error("Revert error:", error);
//     res.status(500).json({ success: false, message: error.message });
//   }
// };


exports.revertNewsToVersion = async (req, res) => {
  try {
    const { id, versionNumber } = req.params;

    const currentVersionNumber = parseInt(versionNumber);
    const targetVersionNumber = currentVersionNumber - 1;

    // Find the version to revert to
    const targetVersion = await NewsVersion.findOne({
      newsId: id,
      versionNumber: targetVersionNumber,
    });

    if (!targetVersion) {
      return res.status(404).json({ success: false, message: "Target version not found." });
    }

    // Overwrite current article with snapshot of previous version
    await News.updateOne({ _id: id }, targetVersion.snapshot);

    // Delete current version
    await NewsVersion.deleteOne({
      newsId: id,
      versionNumber: currentVersionNumber,
    });

    res.status(200).json({ success: true, message: "Reverted and cleaned up successfully" });
  } catch (error) {
    console.error("Error in revertAndDeleteCurrentVersion:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};
exports.deleteVersion = async (req, res) => {
  try {
    const { id, versionNumber } = req.params;

    const deleted = await NewsVersion.findOneAndDelete({ newsId: id, versionNumber });
    if (!deleted) {
      return res.status(404).json({ success: false, message: "Version not found" });
    }

    // STEP 2: Renumber all remaining versions sequentially
    const versions = await NewsVersion.find({ newsId: id }).sort({ versionNumber: 1 });

    for (let i = 0; i < versions.length; i++) {
      versions[i].versionNumber = i + 1;
      await versions[i].save();
    }

    res.status(200).json({ success: true, message: "Version deleted and renumbered successfully" });
  } catch (error) {
    console.error("Error in deleteVersion:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};


exports.getNewsByNewsType = async (req, res) => {
  try {
    const { newsType } = req.params;
    const news = await News.find({ newsType })
    .sort({ createdTime: -1 });
    res.status(200).json({ success: true, data: news });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.addNewsToPlaylist = async (req, res) => {
  try {
    const { userId, newsId } = req.body;

    // Validate inputs
    if (!userId || !newsId) {
      return res.status(400).json({ message: "userId and newsId are required" });
    }

    // Check if user and news exist
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    const news = await News.findById(newsId);
    if (!news) return res.status(404).json({ message: "News not found" });

    // Prevent duplicates
    const alreadyExists = user.playlist?.newsplaylist?.some(
      (item) => item.newsId.toString() === newsId
    );
    if (alreadyExists)
      return res.status(400).json({ message: "News already in playlist" });

    // Add to playlist
    user.playlist.newsplaylist.push({ newsId });
    await user.save();

    res.status(200).json({
      message: "News added to playlist successfully",
      playlist: user.playlist.newsplaylist,
    });
  } catch (error) {
    console.error("Error adding news to playlist:", error);
    res.status(500).json({ message: "Server error", error });
  }
};


exports.removeNewsFromPlaylist = async (req, res) => {
  try {
    const { userId, newsId } = req.body;

    if (!userId || !newsId) {
      return res.status(400).json({ success: false, message: "userId and newsId are required" });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    // Defensive checks to avoid crashes
    if (!user.playlist) user.playlist = {};
    if (!user.playlist.newsplaylist) user.playlist.newsplaylist = [];

    // Filter out the newsId
    user.playlist.newsplaylist = user.playlist.newsplaylist.filter(
      (item) => item.newsId && item.newsId.toString() !== newsId
    );

    await user.save();

    res.status(200).json({
      success: true,
      message: "News removed from playlist successfully",
      playlist: user.playlist.newsplaylist,
    });
  } catch (error) {
    console.error("Error removing news from playlist:", error);
    res.status(500).json({ success: false, message: "Server error", error });
  }
};


exports.getNewsPlaylist = async (req, res) => {
  const { userId } = req.params;
  const user = await User.findById(userId).populate("playlist.newsplaylist.newsId");
  if (!user) return res.status(404).json({ message: "User not found" });
  res.status(200).json({ playlist: user.playlist.newsplaylist });
};
