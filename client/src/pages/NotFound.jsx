import { Link } from 'react-router-dom';
import { Empty } from '../components/ui.jsx';

export default function NotFound() {
  return (
    <div className="container section">
      <Empty icon="🍿" title="This page went out for popcorn">
        <p>We couldn't find what you were looking for.</p>
        <Link to="/" className="btn btn-primary">Back to home</Link>
      </Empty>
    </div>
  );
}
