CREATE TABLE `job_runs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`job` varchar(64) NOT NULL,
	`started_at` timestamp(3) NOT NULL DEFAULT (now()),
	`finished_at` timestamp(3),
	`ok` boolean NOT NULL DEFAULT false,
	`examined` int NOT NULL DEFAULT 0,
	`changed` int NOT NULL DEFAULT 0,
	`stopped_early` boolean NOT NULL DEFAULT false,
	`note` varchar(500) NOT NULL DEFAULT '',
	CONSTRAINT `job_runs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `job_runs_job_started_idx` ON `job_runs` (`job`,`started_at`);