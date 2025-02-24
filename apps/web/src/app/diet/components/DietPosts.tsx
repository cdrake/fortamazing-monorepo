import { dietPosts } from '../data/posts'

export default function DietPosts() {
  return (
    <div>
      <h2>Diet Posts</h2>
      <ul>
        {dietPosts.map(post => (
          <li key={post.id}>
            <h3>{post.title}</h3>
            <p>{post.content}</p>
          </li>
        ))}
      </ul>
    </div>
  )
}
