import FollowList, { followListMetadata } from '../FollowList';

type Params = Promise<{ username: string }>;

export async function generateMetadata({ params }: { params: Params }) {
  return followListMetadata((await params).username, 'following');
}

export default async function Page({ params }: { params: Params }) {
  return <FollowList username={(await params).username} direction='following' />;
}
