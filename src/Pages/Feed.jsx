// pages/Feed.jsx
import { useEffect, useState } from 'react';
import axios from 'axios';
import { auth } from '../firebase';
import { useNavigate } from 'react-router-dom';

const Feed = () => {
  const [articles, setArticles] = useState([]);
  const [filteredArticles, setFilteredArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [user, setUser] = useState(null);
  const [dateFilter, setDateFilter] = useState('all'); // 'all', 'today', 'week', 'month'
  const [topicFilter, setTopicFilter] = useState('all'); // 'all', 'depression', 'anxiety', etc.
  const navigate = useNavigate();

  // Topics for filtering
  const topics = [
    { value: 'all', label: 'All Topics' },
    { value: 'depression', label: 'Depression' },
    { value: 'anxiety', label: 'Anxiety' },
    { value: 'stress', label: 'Stress' },
    { value: 'therapy', label: 'Therapy' },
    { value: 'mindfulness', label: 'Mindfulness' },
    { value: 'wellbeing', label: 'Wellbeing' },
  ];

  const API_KEY = import.meta.env.VITE_NEWS_API_KEY;
  const API_URL = `https://newsapi.org/v2/everything?q=mental%20health&apiKey=${API_KEY}`;

  // Check authentication status
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((authUser) => {
      if (authUser) {
        setUser(authUser);
      } else {
        setUser(null);
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  // Fetch articles from NewsAPI only if user is authenticated
  useEffect(() => {
    if (user) {
      const fetchArticles = async () => {
        try {
          const response = await axios.get(API_URL);
          if (response.data.status === 'ok') {
            const articlesWithDates = response.data.articles.map(article => ({
              ...article,
              publishedAt: new Date(article.publishedAt),
              // Add a topic property based on content (simplified for demo)
              topic: detectTopic(article.title, article.description)
            }));
            setArticles(articlesWithDates);
            setFilteredArticles(articlesWithDates); // Initially show all articles
            setLoading(false);
          } else {
            throw new Error(response.data.message || 'Failed to fetch articles');
          }
        } catch (err) {
          console.error('API Error:', err.response ? err.response.data : err.message);
          setError(
            err.response?.status === 401
              ? 'Invalid API key. Please contact support.'
              : err.message || 'Failed to load articles. Please try again later.'
          );
          setLoading(false);
        }
      };
      fetchArticles();
    }
  }, [user, API_URL]);

  // Helper function to detect topic from article content (simplified)
  const detectTopic = (title, description) => {
    const content = `${title} ${description}`.toLowerCase();
    
    if (content.includes('depress')) return 'depression';
    if (content.includes('anxiet')) return 'anxiety';
    if (content.includes('stress')) return 'stress';
    if (content.includes('therap')) return 'therapy';
    if (content.includes('mindful')) return 'mindfulness';
    if (content.includes('wellbeing') || content.includes('well-being')) return 'wellbeing';
    
    return 'other';
  };

  // Filter articles by date and topic
  useEffect(() => {
    if (articles.length === 0) return;

    const now = new Date();
    let filtered = [...articles];

    // Apply date filter
    switch (dateFilter) {
      case 'today':
        filtered = filtered.filter(article => {
          const articleDate = article.publishedAt;
          return (
            articleDate.getDate() === now.getDate() &&
            articleDate.getMonth() === now.getMonth() &&
            articleDate.getFullYear() === now.getFullYear()
          );
        });
        break;
      case 'week':
        const oneWeekAgo = new Date(now);
        oneWeekAgo.setDate(now.getDate() - 7);
        filtered = filtered.filter(article => article.publishedAt >= oneWeekAgo);
        break;
      case 'month':
        const oneMonthAgo = new Date(now);
        oneMonthAgo.setMonth(now.getMonth() - 1);
        filtered = filtered.filter(article => article.publishedAt >= oneMonthAgo);
        break;
      default:
        // No date filtering
        break;
    }

    // Apply topic filter
    if (topicFilter !== 'all') {
      filtered = filtered.filter(article => 
        article.topic === topicFilter
      );
    }

    setFilteredArticles(filtered);
  }, [dateFilter, topicFilter, articles]);

  // Navigation handlers
  const handleSignup = () => {
    navigate('/signup');
  };

  const handleLogin = () => {
    navigate('/login');
  };

  // Render for unauthenticated users
  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-4">
        <p className="text-xl text-gray-700 mb-6">
          Create your account with the Sign Up button and login to the system to view mental health articles.
        </p>
        <div className="flex gap-4">
          <button
            onClick={handleSignup}
            className="bg-green-600 text-white p-2 rounded-lg hover:bg-green-700 px-6"
          >
            Sign Up
          </button>
          <button
            onClick={handleLogin}
            className="bg-blue-600 text-white p-2 rounded-lg hover:bg-blue-700 px-6"
          >
            Login
          </button>
        </div>
      </div>
    );
  }

  // Render for authenticated users
  if (loading) {
    return <div className="p-4">Loading articles...</div>;
  }

  if (error) {
    return <div className="p-4 text-red-500">Error: {error}</div>;
  }

  return (
    <div className="p-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <h1 className="text-2xl font-bold">Mental Health Articles</h1>
        <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-2 sm:space-y-0 sm:space-x-2">
          <div className="flex items-center space-x-2">
            <label htmlFor="topic-filter" className="text-sm font-medium text-gray-700">
              Topic:
            </label>
            <select
              id="topic-filter"
              value={topicFilter}
              onChange={(e) => setTopicFilter(e.target.value)}
              className="border rounded-md p-2 text-sm"
            >
              {topics.map((topic) => (
                <option key={topic.value} value={topic.value}>
                  {topic.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center space-x-2">
            <label htmlFor="date-filter" className="text-sm font-medium text-gray-700">
              Date:
            </label>
            <select
              id="date-filter"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="border rounded-md p-2 text-sm"
            >
              <option value="all">All Dates</option>
              <option value="today">Today</option>
              <option value="week">Last Week</option>
              <option value="month">Last Month</option>
            </select>
          </div>
        </div>
      </div>

      {filteredArticles.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-gray-500">No articles found for the selected filters.</p>
          <button
            onClick={() => {
              setTopicFilter('all');
              setDateFilter('all');
            }}
            className="mt-2 text-blue-500 hover:underline"
          >
            Clear all filters
          </button>
        </div>
      ) : (
        <>
          <div className="mb-4 text-sm text-gray-500">
            Showing {filteredArticles.length} article{filteredArticles.length !== 1 ? 's' : ''}
            {topicFilter !== 'all' && ` about ${topics.find(t => t.value === topicFilter)?.label}`}
            {dateFilter !== 'all' && ` from ${dateFilter}`}
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredArticles.map((article, index) => (
              <div key={index} className="border p-4 rounded-lg shadow-md hover:shadow-lg transition-shadow">
                {article.urlToImage && (
                  <img
                    src={article.urlToImage}
                    alt={article.title}
                    className="w-full h-48 object-cover rounded-t-lg"
                  />
                )}
                <div className="mt-2">
                  <span className="inline-block bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full mb-2">
                    {topics.find(t => t.value === article.topic)?.label || 'Other'}
                  </span>
                </div>
                <h2 className="text-xl font-semibold mt-2">{article.title}</h2>
                <p className="text-gray-600 text-sm mb-2">
                  {article.publishedAt.toLocaleDateString()}
                </p>
                <p className="text-gray-600 line-clamp-3">{article.description}</p>
                <a
                  href={article.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block mt-3 text-blue-500 hover:underline"
                >
                  Read more →
                </a>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default Feed;