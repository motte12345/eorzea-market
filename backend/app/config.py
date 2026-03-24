from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "mysql+aiomysql://eorzea:eorzea@localhost:3306/eorzea_market?charset=utf8mb4"
    database_url_sync: str = "mysql+pymysql://eorzea:eorzea@localhost:3306/eorzea_market?charset=utf8mb4"
    universalis_base_url: str = "https://universalis.app/api/v2"
    universalis_rate_limit: float = 10.0  # req/s (14が上限だが余裕を持つ)
    xivapi_base_url: str = "https://xivapi.com"

    class Config:
        env_file = ".env"


settings = Settings()
