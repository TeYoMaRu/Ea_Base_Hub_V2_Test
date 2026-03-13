export async function sendLineNotify(data){

  await fetch(
    "https://vhazgytcfvjhihkiqpwm.supabase.co/functions/v1/send-line-notify",
    {
      method: "POST",
      headers:{
        "Content-Type":"application/json"
      },
      body: JSON.stringify(data)
    }
  );

}