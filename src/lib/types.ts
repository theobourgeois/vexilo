export type RelatedFlag = {
	name: string;
	image: string;
	id: string;
};

export type Flag = {
	id: string;
	flagName: string;
	flagImage: string;
	link: string;
	index: number;
	tags: string[];
	description: string;
	favorites?: number;
	isFavorite?: boolean;
	relatedFlags?: RelatedFlag[];
};

export type FlagRequestWithUser = {
	id: string;
	userId: string;
	oldFlag: Omit<Flag, "id"> | null;
	approved: boolean;
	flag: Omit<Flag, "id">;
	flagId: string | null;
	isEdit: boolean;
	createdAt: Date;
	updatedAt: Date;
	deleted: boolean;
	userMessage: string;
	userName: string | null;
};
