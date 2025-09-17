import mongoose from 'mongoose';

const BlogSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters']
  },
  content: {
    type: String,
    required: [true, 'Content is required'],
    minlength: [10, 'Content must be at least 10 characters']
  },
  excerpt: {
    type: String,
    required: [true, 'Excerpt is required'],
    maxlength: [300, 'Excerpt cannot exceed 300 characters']
  },
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Author is required']
  },
  category: {
    type: String,
    required: [true, 'Category is required'],
    enum: ['Technology', 'Design', 'Development', 'Business', 'Lifestyle', 'Travel', 'Food', 'Health', 'Education', 'Entertainment', 'Other'],
    default: 'Other'
  },
  tags: [{
    type: String,
    trim: true,
    maxlength: [20, 'Tag cannot exceed 20 characters']
  }],
  media: {
    type: {
      type: String,
      enum: ['image', 'video', 'none'],
      default: 'none'
    },
    url: {
      type: String,
      default: 'https://images.unsplash.com/photo-1486312338219-ce68d2c6f44d?w=600&h=400&fit=crop'
    },
    public_id: String,
    format: String,
    size: Number,
    duration: Number,
    thumbnail: String
  },
  mediaGallery: [{
    type: {
      type: String,
      enum: ['image', 'video'],
      required: true
    },
    url: {
      type: String,
      required: true
    },
    public_id: String,
    format: String,
    size: Number,
    duration: Number,
    order: {
      type: Number,
      default: 0
    },
    placement: {
      type: String,
      enum: ['header', 'inline', 'footer'],
      default: 'header'
    }
  }],
  
  status: {
    type: String,
    enum: ['draft', 'published', 'archived'],
    default: 'draft'
  },
  publishedAt: {
    type: Date,
    default: null
  },
  readTime: {
    type: Number,
    min: [1, 'Read time must be at least 1 minute'],
    default: 5
  },
  views: {
    type: Number,
    default: 0
  },
  likes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  comments: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    content: {
      type: String,
      required: true,
      maxlength: [1000, 'Comment cannot exceed 1000 characters']
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  
}, {
  timestamps: true
});

BlogSchema.index({ title: 'text', content: 'text', tags: 'text' });
BlogSchema.index({ author: 1, createdAt: -1 });
BlogSchema.index({ category: 1, status: 1 });

BlogSchema.virtual('likeCount').get(function() {
  return this.likes.length;
});

BlogSchema.virtual('commentCount').get(function() {
  return this.comments.length;
});

BlogSchema.methods.incrementViews = function() {
  this.views += 1;
  return this.save();
};

BlogSchema.methods.toggleLike = function(userId) {
  try {
    const likeIndex = this.likes.indexOf(userId);
    if (likeIndex > -1) {
      this.likes.splice(likeIndex, 1);
    } else {
      this.likes.push(userId);
    }
    return this.save();
  } catch (error) {
    console.error('Toggle like error:', error);
    throw error;
  }
};

BlogSchema.methods.updateMedia = function(mediaData) {
  this.media = mediaData;
  return this.save();
};

BlogSchema.set('toJSON', { virtuals: true });
BlogSchema.set('toObject', { virtuals: true });

const Blog = mongoose.model('Blog', BlogSchema);

export default Blog;