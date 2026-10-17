export type BirthdayCardAttachment = {
  filename: string;
  content: string;
  content_type: "image/svg+xml";
};

export function birthdayCardSvg(memberName: string, communityName: string): string;
export function birthdayCardAttachment(
  memberName: string,
  communityName: string,
): BirthdayCardAttachment;
