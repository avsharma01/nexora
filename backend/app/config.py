import os

from dotenv import load_dotenv

load_dotenv()


class Settings:
    APP_NAME = os.getenv("APP_NAME", "NEXORA")
    APP_ENV = os.getenv("APP_ENV", "development")

    POSTGRES_DB = os.getenv("POSTGRES_DB", "nexora")
    POSTGRES_USER = os.getenv("POSTGRES_USER", "nexora")
    POSTGRES_PASSWORD = os.getenv("POSTGRES_PASSWORD", "")
    POSTGRES_HOST = os.getenv("POSTGRES_HOST", "localhost")
    POSTGRES_PORT = os.getenv("POSTGRES_PORT", "5432")

    JWT_SECRET_KEY = os.getenv(
        "JWT_SECRET_KEY",
        "change_this_to_a_long_random_secret",
    )

    JWT_ACCESS_TOKEN_EXPIRE_MINUTES = int(
        os.getenv(
            "JWT_ACCESS_TOKEN_EXPIRE_MINUTES",
            "30",
        )
    )
settings = Settings()