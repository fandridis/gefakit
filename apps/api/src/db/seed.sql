-- Seed data for the database

-- Insert 5 authors
INSERT INTO authors (username, email, avatar_url) VALUES 
('johndoe', 'john@example.com', 'https://randomuser.me/api/portraits/men/1.jpg'),
('janedoe', 'jane@example.com', 'https://randomuser.me/api/portraits/women/2.jpg'),
('bobsmith', 'bob@example.com', 'https://randomuser.me/api/portraits/men/3.jpg'),
('alicejones', 'alice@example.com', 'https://randomuser.me/api/portraits/women/4.jpg'),
('mikebrown', 'mike@example.com', 'https://randomuser.me/api/portraits/men/5.jpg');

-- Insert 10 posts
INSERT INTO posts (author_id, title, content) VALUES
(1, 'Getting Started with Web Development', 'Web development is an exciting field that combines creativity and technical skills...'),
(2, 'My Journey as a Designer', 'I started my design career five years ago and wanted to share some insights...'),
(3, 'The Future of AI', 'Artificial intelligence is rapidly evolving and changing how we interact with technology...'),
(1, 'JavaScript Tips and Tricks', 'Here are some lesser-known JavaScript features that can improve your code...'),
(4, 'UX Research Methods', 'Effective user research is crucial for creating products people love...'),
(5, 'Building Scalable Systems', 'When designing systems that need to scale, consider these architectural patterns...'),
(2, 'Color Theory Basics', 'Understanding color theory can dramatically improve your design work...'),
(3, 'Machine Learning for Beginners', 'Getting started with machine learning might seem intimidating, but...'),
(4, 'Accessibility in Design', 'Creating accessible designs is not just good practice, it''s essential...'),
(5, 'DevOps Best Practices', 'Implementing these DevOps practices can streamline your development workflow...');

-- Insert 5 comments
INSERT INTO comments (post_id, author_id, content) VALUES
(1, 3, 'Great introduction! I would also recommend learning about responsive design.'),
(2, 1, 'Your journey is inspiring. What tools do you recommend for beginners?'),
(3, 4, 'I agree that AI will transform many industries. What about ethical considerations?'),
(5, 2, 'I''ve been using these research methods and they''ve improved my design process significantly.'),
(8, 5, 'This is exactly what I needed as a beginner in machine learning. Thanks!');

-- Insert 20 likes
INSERT INTO likes (author_id, post_id, comment_id) VALUES
(2, 1, NULL),
(3, 1, NULL),
(4, 1, NULL),
(5, 1, NULL),
(1, 2, NULL),
(3, 2, NULL),
(4, 2, NULL),
(1, 3, NULL),
(2, 3, NULL),
(5, 3, NULL),
(2, 4, NULL),
(3, 4, NULL),
(1, 5, NULL),
(5, 5, NULL),
(1, NULL, 1),
(2, NULL, 1),
(3, NULL, 2),
(4, NULL, 3),
(5, NULL, 4),
(1, NULL, 5);
