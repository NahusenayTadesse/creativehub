/* Creators' reviews of brands were written and never counted. Count the ones
   already on file once; `recalcOrganizationRatings` keeps them current. */
UPDATE `organizations` o
LEFT JOIN (
	SELECT `organization_id`, COUNT(*) AS review_count, AVG(`rating`) AS rating_avg
	FROM `reviews`
	WHERE `direction` = 'creator_to_brand' AND `is_active` = true AND `deleted_at` IS NULL
	GROUP BY `organization_id`
) agg ON agg.`organization_id` = o.`id`
SET o.`reviews_count` = COALESCE(agg.review_count, 0),
	o.`average_rating` = ROUND(COALESCE(agg.rating_avg, 0), 2);
