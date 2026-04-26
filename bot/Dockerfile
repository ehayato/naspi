FROM python:3.9-slim

WORKDIR /app

ENV TZ=Asia/Tokyo

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

CMD ["python", "discord-bot.py"]
