CREATE DATABASE IF NOT EXISTS `mitadb`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

USE `mitadb`;

CREATE TABLE IF NOT EXISTS `user` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `nama_user` VARCHAR(150) NOT NULL,
  `level` ENUM('admin', 'operator', 'viewer') NOT NULL DEFAULT 'viewer',
  PRIMARY KEY (`id`),
  KEY `idx_user_level` (`level`)
) ENGINE=InnoDB
  DEFAULT CHARACTER SET=utf8mb4
  COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `opd` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `nama_opd` VARCHAR(150) NOT NULL,
  `link_website` VARCHAR(500) NOT NULL,
  `is_aktif` TINYINT(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_opd_nama` (`nama_opd`),
  UNIQUE KEY `uq_opd_website` (`link_website`)
) ENGINE=InnoDB
  DEFAULT CHARACTER SET=utf8mb4
  COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `feed` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `id_opd` BIGINT UNSIGNED NOT NULL,
  `link_feed` VARCHAR(700) NOT NULL,
  `is_aktif` TINYINT(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_feed_opd_link` (`id_opd`, `link_feed`),
  KEY `idx_feed_aktif_opd` (`is_aktif`, `id_opd`),
  CONSTRAINT `fk_feed_opd`
    FOREIGN KEY (`id_opd`) REFERENCES `opd` (`id`)
    ON UPDATE CASCADE
    ON DELETE CASCADE
) ENGINE=InnoDB
  DEFAULT CHARACTER SET=utf8mb4
  COLLATE=utf8mb4_0900_ai_ci;
